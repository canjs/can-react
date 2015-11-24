import can from "can/util/";
import "can/util/vdom/";

var docEl = can.global.document.documentElement;
var Element = docEl.constructor;
var ChildNodes = docEl.childNodes.constructor;
var Node = Element.prototype.nodeConstructor;

// We only want to process this code if we are using can-simple-dom.
// can-simple-dom puts a nodeConstructor property on the Element prototype.
if (Node) {
  // Bind against a childNodes property
  var reindexNodes = function reindexNodes () {
    var child = this.node.firstChild;
    this._length = 0;
    
    while (child) {
      this[this._length++] = child;
      child = child.nextSibling;
    }
  };

  // Add support for childNodes.length
  if (Object.defineProperty) {
    Object.defineProperty(ChildNodes.prototype, "length", {
      get: function () {
        if (!this._length) {
          reindexNodes.call(this);
        }

        return this._length;
      },
      set: function (val) {
        this._length = val;
      }
    });
  }

  var oldAppend = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    var ret = oldAppend.call(this, node);
    this.childNodes[this.childNodes.length] = node;
    return ret;
  };

  var oldRemove = Node.prototype.removeChild;
  Node.prototype.removeChild = function (node) {
    var ret = oldRemove.call(this, node);
    reindexNodes.call(this.childNodes);
    return ret;
  };

  var oldInsert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, refNode) {
    var ret = oldInsert.call(this, node);
    // if refNode == null, the base insert calls appendChild
    if (refNode != null) {
      reindexNodes.call(this.childNodes);
    }
    return ret;
  };

  // Add support for element.hasAttribute
  Element.prototype.hasAttribute = function(_name) {
    var attributes = this.attributes;
    var name = _name.toLowerCase();
    var attr;
    for (var i=0, l=attributes.length; i<l; i++) {
      attr = attributes[i];
      if (attr.name === name) {
        return true;
      }
    }
    return false;
  };
}
