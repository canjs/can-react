import can from "can/util/";
import AppMap from "can-ssr/app-map";

var oldSetup = AppMap.prototype.setup;
AppMap.prototype.setup = function () {
	oldSetup.apply(this, arguments);
	this.__readyPromise = can.Deferred();
};

AppMap.prototype.__pluckPromise = function (promise) {
	var pIndex = this.__readyPromises.indexOf(promise);
	if (pIndex > -1) {
		this.__readyPromises.splice(pIndex, 1);
	}

	if (this.__readyPromises.length === 0) {
		setTimeout(() => {
			if (this.__readyPromises.length === 0) {
				this.__readyPromise.resolve();
			}
		});
	}
};

AppMap.prototype.waitFor = function(promise) {
	this.__readyPromises.push(promise);

	//!steal-remove-start
	// Clever little way of getting the module path and line
	// number where this promise is defined (3rd line of stack).
	var err = new Error();
	var parentFile = err.stack.split(/[\r\n]/)[2].split("/").slice(1).join("/");
	//!steal-remove-end

	promise.then(() => {
		this.__pluckPromise(promise);
	}, (err) => {
		//!steal-remove-start
		console.log("༼ つ ◕_◕ ༽つ ~~~ A promise has failed to hold up its end of the bargain!!! \nPromise source:", parentFile, "\nERROR:", (err.stack || err));
		//!steal-remove-end
		this.__pluckPromise(promise);
	});

	return promise;
};

AppMap.prototype.readyPromise = function () {
	if (this.__readyPromises.length === 0) {
		this.__readyPromise.resolve();
	}
	return this.__readyPromise;
};

export default AppMap;
