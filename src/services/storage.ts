import mongoose = require("mongoose");
import { CallbackType } from "../types/Callback";
import { Response } from "express";
import { Model, Query, Document } from "mongoose";
import { TranformableModel } from "../types/TransformableModel";
const config = require("../config");
const logger = require("../logger.js");
require("../models");

class StorageService {
  start(ready: CallbackType, args: any) {
    let options = Object.assign({}, config, args);
    let { dbName, dbHost } = options;
    const connectUrl = `mongodb://${dbHost}/${dbName}?socketTimeoutMS=3600000&noDelay=true`;
    let attemptConnect = async () => {
      return mongoose.connect(connectUrl, {
        keepAlive: 1,
        poolSize: config.maxPoolSize,
        nativeParser: true
      });
    };
    let attempted = 0;
    let attemptConnectId = setInterval(async () => {
      try {
        let data = await attemptConnect();
        clearInterval(attemptConnectId);
        ready(null, data);
      } catch (err) {
        logger.error(err);
        attempted++;
        if (attempted > 5) {
          clearInterval(attemptConnectId);
          ready(err);
        }
      }
    }, 5000);
  }

  stop() {}

  apiStreamingFind<T extends Document>(
    model: TranformableModel<T>,
    query: Query<T>,
    res: Response
  ) {
    
    let cursor = model.find(query).cursor({
      transform: model._apiTransform
    });
    cursor.on("error", function(err) {
      return res.status(500).end(err.message);
    });
    let isFirst = true;
    res.type("json");
    cursor.on("data", function(data) {
      if (isFirst) {
        res.write("[\n");
        isFirst = false;
      } else {
        res.write(",\n");
      }
      res.write(data);
    });
    cursor.on("end", function() {
      if (isFirst) {
        // there was no data
        res.write("[]");
      } else {
        res.write("]");
      }
      res.end();
    });
  }
}

module.exports = new StorageService();