import React from 'react';
import can from 'can';

let thingsNotToMerge = {
	render: true,
	ViewModel: true,
	getInitialState: true
};

//!steal-remove-start
let validateProto = (proto) => {
	let err = '';
	let vm = proto.ViewModel;
	let gis = proto.getInitialState;
	
	if (!vm && !gis) {
		can.dev.warn("You must provide either a ViewModel property or getInitialState method to CanReact.createClass.");
	}

	if (vm && typeof vm.newInstance !== "function") {
		can.dev.warn("The ViewModel property must be a can.Map constructor - ViewModel: can.Map.extend({...});");
	}

	if (gis && typeof gis !== "function") {
		can.dev.warn("getInitialState must be a function which returns an instance of a can.Map - return new ViewModel();");	
	}

	if (err) {
    throw new Error(err);
  }
};
//!steal-remove-end

export default {
	createClass(proto) {
		//!steal-remove-start
		validateProto(proto);
		//!steal-remove-end

		class Component extends React.Component {
			constructor(props) {
				super(props);

				// allow both ViewModel and getInitialState
				this.state = {};
				if (proto.ViewModel) {
					this.state = new proto.ViewModel(props);
				}
				if (proto.getInitialState) {
					can.extend(this.state, proto.getInitialState.call(this));
				}
				
				this.renderer = can.compute(proto.render.bind(this));

				this.changeHandler = () => {
					Component.prototype.changeHandler.apply(this, arguments);
				};
			}

			//!steal-remove-start
			forceUpdate () {
				can.dev.warn("Calling forceUpdate on a component is indicative of improper use of the can-react component and will not produce the results you expect. In order to trigger a rerender, views should access properties using this.state.attr('propertyName') and application code should update these properties using this.state.attr('propertyName', newValue).");
				React.Component.prototype.forceUpdate.call(this);
			}
			//!steal-remove-end

			changeHandler () {
				// Calling React's prototype method skips the dev-mode warning
				// This is the only place in the app that should call forceUpdate
				React.Component.prototype.forceUpdate.call(this);
			}

			componentWillMount () {
				this.renderer.bind('change', this.changeHandler);
			}

			componentWillUnmount () {
				this.renderer.unbind('change', this.changeHandler);
			}

			render() {
				return this.renderer();
			}
		}

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
