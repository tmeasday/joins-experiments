// TODO: could take fields as an argument to allow only responding to
//    changes to relevant fields
subscriptionForEach = function(sub, cursor, handler) {
  // : _id => SubscriptionTree
  var forEachChildren = {};
  var addChild = function(id, doc) {
    forEachChildren[id] = sub.publishChild(handler, _.extend({_id: id}, doc));
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
      sub._checkTreeReady();
    },
    removed: function(id) {
      forEachChildren[id].stop();
      delete forEachChildren[id];
      sub._checkTreeReady();
    }
  });
  
  sub.onStop(function() {
    handle.stop();
  });
}