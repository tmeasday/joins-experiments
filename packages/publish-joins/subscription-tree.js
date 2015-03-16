// HACK: to gain access to the subscription prototype, see below.
var Subscription;

// Use "psuedo-subscription" objects that represent
//   the document levels. 
//
// The rules are:
//   - an outer sub kills it's children, like computations
//   - each inner sub is attached to a document, when the doc is removed,
//     the sub is stopped
//   - child subs pass added/etc/ready to parent sub
//   - parent sub is only ready when all children + itself are ready.
SubscriptionTree = function(parentSubscription, notRoot) {
  var self = this;
  
  // this will definitely work the first time ;)
  if (! notRoot) {
    setSubscriptionPrototype(parentSubscription.constructor);
  }
  
  // it's too late to call Meteor._inherits so let's try this slightly wacky
  //   approach
  _.extend(this.constructor.prototype, Subscription.prototype, subscriptionTreeMethods);
  
  
  // XXX: should we generate a name like flips.0.1?, likewise a _subscriptionId?
  //   for the moment all names are undefined, this will appear a universal sub
  Subscription.call(self, parentSubscription._session);
  
  self._root = ! notRoot;
  self.parent = parentSubscription;
  self._children = [];
  // is this particular subscription ready?
  self._nodeReady = false;
  // is the entire tree of this and it's children ready?
  self._treeReady = false;

  self.parent.onStop(function() {
    self.stop();
  });
}

var subscriptionTreeMethods = {
  // TODO: is this the best name?
  publish: function(handler) {
    // TODO: should we not be so hacky here?
    this._handler = handler;
    this._params = Array.prototype.slice.call(arguments, 1);
    this._runHandler();
  },
  
  publishChild: function(handler /*, arguments */) {
    var child = new SubscriptionTree(this, true);
    this._children.push(child);
    child.publish.apply(child, arguments);
    return child;
  },

  _checkTreeReady: function() {
    var allChildrenReady = _.all(this._children, function(child) {
      return child._treeReady;
    });
    this._treeReady = (allChildrenReady && this._nodeReady);
    if (this._treeReady) { 
      if (this._root) {
        this.parent.ready();
      } else {
        this.parent._checkTreeReady();
      }
    }
  },
  
  // TODO: could take fields as an argument to allow only responding to
  //    changes to relevant fields
  forEach: function(cursor, handler) {
    var self = this;
    
    // : _id => SubscriptionTree
    var forEachChildren = {};
    var addChild = function(id, doc) {
      forEachChildren[id] = self.publishChild(handler, _.extend({_id: id}, doc));
    };

    var handle = cursor.observeChanges({
      added: function(id, doc) {
        addChild(id, doc);
      }, 
      changed: function(id, mod) {
        // if we had fields above, we could short-circuit in some cases here.
      
        // TODO: are there any conditions under which we can re-use the old sub?
        //   - Not in general
        //   - If old + new both returned cursors, could we check if they are
        //       the same? Or is that a pointless optimization?
        var oldChild = forEachChildren[id];
      
        // TODO: there should be an official API to do this?
        var doc = handle._multiplexer._cache.docs.get(id);
        addChild(id, doc);
      
        // We stop the old child after we start the new sub, so if there
        //   are common cursors, we don't teardown and re-establish the
        //   observers -- we just gracefully re-use the old one.
        oldChild.stop();
        self._checkTreeReady();
      },
      removed: function(id) {
        forEachChildren[id].stop();
        delete forEachChildren[id];
        self._checkTreeReady();
      }
    });
  },
  
  ready: function() {
    this._nodeReady = true;
    this._checkTreeReady();
  },

  stop: function() {
    this._removeAllDocuments();
    this._deactivate();
  }
};

var setSubscriptionPrototype = function(s) {
  if (Subscription) {
    return;
  }
   
  Subscription = s;
}
