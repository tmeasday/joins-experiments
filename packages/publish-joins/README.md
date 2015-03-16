# Publish Joins

A package to provide a simple API to publish joins.

```
Meteor.publish('flip', function(flipId) {
  PublishJoins(this, Flips.find(flipId), {
    responses: {
      comments: {
        helpfuls: {}
      }
    }
  });
});
```

The idea is that the transform for a flip gives us `flip.responses()`, which returns a cursor that we'd like to publish *and observe* -- and we'd like to publish the `comments()` for each response also.

## SubscriptionTree

This is the meat of the package (soon to be an upstream PR?).

The idea of a subscription tree is to solve two problems:

### Problem 1: Subscription "contexts"

When you are constructing a "tree" of subscribed documents (as above -- each flip leads to a set of responses, each of which leads to a set of comments, etc), it's very natural to want to be able to "prune" a branch of the tree when the relevant document is removed (or changed in some relevant way).

For example, if a response is removed, you want to call `this.removed()` for:
  - the `response`
  - all of it's `comments`
  - all of *their* `helpfuls`

It's very natural to do this with a shell of containing subscriptions, each of which can be killed independently. Very much analogously to `Tracker.autorun`s.

### Problem 2: Overlapping cursors

Currently, you cannot publish two cursors from a single subscription. This is more fundamentally because you cannot call `this.added()` twice on the same document. Consider the following:

  1. First cursor calls `this.added()` with one set of fields
  2. Second cursor calls `this.added()` with a second set of fields
  3. First cursor calls `this.removed()`

How is the merge box supposed to know (a) whether or not to remove the document entirely? (b) if not, which set of fields to remove?

### Solution: Subscription Trees

The answer is to allow subscriptions to have anonymous child subscriptions that *have their own `_subscriptionHandle`s*. Then if the subscriptions follow some simple rules around readiness and stopping, we solve the two problems above, very naturally.

The rules are:
  - a parent sub kills it's children, like computations
  - a parent sub is only ready when all children + itself are ready.

### Easter egg: `SubscriptionTree.prototype.forEach`

With the above in place, we can write a straightforward function that reactively (using the observe API), sets up and tears down a child subscription for each document matching a cursor. 

Armed with that function, implementing publish-joins (or many other reactive publication APIs) is a trivial 17 lines of code.