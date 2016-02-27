import React from 'react';
import ReactDOM from 'react-dom';
import can from 'can';
import Map from 'can/map/';

var isNode = (typeof process === 'object' && {}.toString.call(process) === '[object process]');

var thingsNotToMerge = {
	render: true,
	getInitialState: true,
	template: true
};

//!steal-remove-start
var validateProto = (proto) => {
	let vm = proto.ViewModel;
	let gis = proto.getInitialState;
	let render = proto.render;
	let template = proto.template;
	
	if (!vm && !gis) {
		can.dev.warn("You must provide either a ViewModel property or getInitialState method to CanReact.createClass.");
	}

	if (vm && gis) {
		can.dev.warn("You using both the ViewModel property and the getInitialState method. The ViewModel property will be ignored in favor of taking the return value from getInitialState.");
	}

	if (vm && typeof vm.newInstance !== "function") {
		can.dev.warn("The ViewModel property must be a can.Map constructor - ViewModel: can.Map.extend({...});");
	}

	if (gis && typeof gis !== "function") {
		can.dev.warn("getInitialState must be a function which returns an instance of a can.Map - return new ViewModel();");	
	}

	if (!render && !template) {
		can.dev.warn("You must provide either a render method or template property to CanReact.createClass.");
	}

	if (render && template) {
		can.dev.warn("You are using both the render method and template property - your render method will be overwritten. If you are needing more control over rendering, omit the template property and implement a render method which invokes the template renderer manually: render () { return renderer(this); }");
	}
};

function misusedMethod (methodName) {
	can.dev.warn("Calling '", methodName, "'on a component is indicative of improper use of the can-react component and will not produce the results you expect. Views should access properties using this.state.attr('propertyName') and application code should update these properties using this.state.attr('propertyName', newValue).");
}
//!steal-remove-end

function getStaticUniqueId () {
	if (this._reactInternalInstance && this._reactInternalInstance._rootNodeID) {
		return this._reactInternalInstance._rootNodeID;
	}
	return "";
}

function cacheComponentState () {
	var win = window || global;
	if (!win.COMPONENT_CACHE) {
		win.COMPONENT_CACHE = {};
	}
	win.COMPONENT_CACHE[ this.__id ] = (this.state.serialize ? this.state.serialize() : this.state);
}

function deleteComponentCache () {
	var win = window || global;
	if (win.COMPONENT_CACHE && win.COMPONENT_CACHE[ this.__id ]) {
		delete win.COMPONENT_CACHE[ this.__id ];
	}
}

function applyComponentCache () {
	var win = window || global;
	if (win.COMPONENT_CACHE && win.COMPONENT_CACHE[ this.__id ]) {
		let data = win.COMPONENT_CACHE[ this.__id ];

		if (this.state.attr) {
			this.state.attr(data);
		} else {
			can.extend(this.state, data);
		}

		deleteComponentCache.call(this);
	}
}

class BaseComponent extends React.Component {
	constructor(props) {
		super(props);

		this.__id = getStaticUniqueId.call(this)
		this.changeHandler = this.changeHandler.bind(this);
	}

	// I don't like this - but there needs to be a reliable way to generate unique IDs
	// that are deterministic - the same on both the server and the client. This is 
	// temporary but works until we can find a better way. Read more about it here:
	// https://github.com/facebook/react/issues/5867
	getUniqueId (prefix) {
		if ( !this._uniqueIdIndex ) {
			this._uniqueIdIndex = 0;
		}

		prefix = (prefix || "") + this.__id + "_";
		
		return prefix + this._uniqueIdIndex++;
	}

	//!steal-remove-start
	setState () {
		misusedMethod("setState");
	}
	forceUpdate () {
		misusedMethod("forceUpdate");
	}
	//!steal-remove-end

	changeHandler (obj, prop) {
		// If not mounted, don't do anything. If it's about to mount, it will render
		// the proper state when it mounts. If it has been unmounted... well, hopefully we 
		// don't have a memory leak.
		if (!this._isMounted) {
			return;
		}

		// If the component tries to update itself while rendering, then we need to 
		// buffer the update and apply it later. This most likely happens when a child component 
		// updates its parent (ex. Page component sets the AppState page title during mount).
		// During SSR, we want to save the new state to the COMPONENT_CACHE so that it's
		// used during initial render on the client.
		if (this._isUpdating) {
			clearTimeout(this.__updateTimer);
			this.__updateTimer = setTimeout(this.changeHandler, 40);
			this.__saveNextState = true;
		}

		if (isNode) {
			// If this flag is set to true, then delete any state that was previously saved to the 
			// COMPONENT_CACHE as it's now stale. If this new state needs to be saved, we do that below.
			if (this.__deleteCachedState) {
				deleteComponentCache.call(this);
				this.__deleteCachedState = false;
			}

			// If we are about to render a buffered update, we want to save the data to
			// COMPONENT_CACHE for use during initial render in the client. We also set a flag 
			// so that if the state changes again, we delete the data in the COMPONENT_CACHE
			// since it will be stale.
			if (this.__saveNextState) {
				cacheComponentState.call(this);
				this.__saveNextState = false;
				this.__deleteCachedState = true;
			}
		}

		// Calling React's prototype method skips the dev-mode warning
		// This is the only place in the app that should call forceUpdate
		React.Component.prototype.forceUpdate.call(this);
	}

	componentWillMount () {
		// console.log("Will Mount", this.name);
		this.renderer.bind('change', this.changeHandler);
	}

	componentDidMount () {
		this._isMounted = true;
		this.element = ReactDOM.findDOMNode(this);
	}

	componentWillUpdate () {
		this.__isUpdating = true;
	}

	componentDidUpdate () {
		this.__isUpdating = false;
	}

	componentWillUnmount () {
		this._isMounted = false;
		this.renderer.unbind('change', this.changeHandler);
	}

	render () {
		return this.renderer();
	}
}

export default {
	createClass(proto) {
		//!steal-remove-start
		validateProto(proto);
		//!steal-remove-end

		class Component extends BaseComponent {
			constructor (props) {
				super(props);

				if (props.__initialState) {
					// This is used during server side rendering. The app viewModel is
					// instantiated _before_ the component is initialized, and the state
					// is passed in on the __initialState prop.
					this.state = props.__initialState;
				} else {
					this.state = {};
					if (proto.ViewModel) {
						this.state = new proto.ViewModel( can.extend({}, props) );
					}

					if (proto.getInitialState) {
						this.state = proto.getInitialState.call(this);

						//!steal-remove-start
						if ( !(this.state instanceof Map) ) {
							can.dev.error("When using the 'getInitialState' method with the can-react component, you must return an instance of can.Map - return new can.Map(this.props);");
						}
						//!steal-remove-end
					}
				}

				if (proto.template) {
					proto.render = function () {
						return proto.template(this);
					};
				}

				applyComponentCache.call(this);
				this.renderer = can.compute(proto.render.bind(this));
			}
		}

		// Copy all methods and properties to the new component prototype.
		// If a BaseComponent method is defined, call the BaseComponent methods first.
		Object.keys(proto).forEach(prop => {
			if (prop in thingsNotToMerge) {
				return;
			}

			let oldVal = Component.prototype[prop];
			let newVal = proto[prop];

			if (typeof newVal === 'function') {
				if (typeof oldVal === 'function') {
					Component.prototype[prop] = function() {
						oldVal.apply(this, arguments);
						return newVal.apply(this, arguments);
					};
				} else {
					Component.prototype[prop] = function() {
						return newVal.apply(this, arguments);
					};
				}
			} else {
				Component.prototype[prop] = newVal;
			}
		});

		return Component;
	}
};
