'use strict';
var BaseService = require('../../service');
var util = require('util');
var Encoding = require('./encoding');
var index = require('../../index');
var log = index.log;

var MempoolService = function(options) {
  BaseService.call(this, options);
  this._db = this.node.services.db;
};

util.inherits(MempoolService, BaseService);

MempoolService.dependencies = ['db'];

MempoolService.prototype.getAPIMethods = function() {
  var methods = [
   ['getMempoolTransaction', this, this.getTransaction, 1]
  ];
  return methods;
};

MempoolService.prototype.start = function(callback) {
  var self = this;

  self._db.getPrefix(self.name, function(err, prefix) {
    if(err) {
      return callback(err);
    }
    self._encoding = new Encoding(prefix);
    self._startSubscriptions();
    callback();
  });
};

MempoolService.prototype._startSubscriptions = function() {

  if (this._subscribed) {
    return;
  }

  this._subscribed = true;
  if (!this._bus) {
    this._bus = this.node.openBus({remoteAddress: 'localhost'});
  }

  this._bus.on('p2p/block', this._onBlock.bind(this));
  this._bus.on('p2p/transaction', this._onTransaction.bind(this));

  this._bus.subscribe('p2p/block');
  this._bus.subscribe('p2p/transaction');
};

MempoolService.prototype._onBlock = function(block) {
  // remove this block's txs from mempool
  var self = this;
  var ops = block.txs.map(function(tx) {
    return {
      type: 'del',
      key: self._encoding.encodeMempoolTransactionKey(tx.txid())
    };
  });
  self._db.batch(ops);
};

MempoolService.prototype._onTransaction = function(tx) {
  this._db.put(this._encoding.encodeMempoolTransactionKey(tx.txid()),
    this._encoding.encodeMempoolTransactionValue(tx));
};

MempoolService.prototype.getMempoolTransaction = function(txid, callback) {
  this._db.get(this._encoding.encodeMempoolTransactionKey(txid), callback);
};

MempoolService.prototype.stop = function(callback) {
  callback();
};


module.exports = MempoolService;
