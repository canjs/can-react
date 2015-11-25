import can from "can/util/";
import AppMap from "can-ssr/app-map";

var oldSetup = AppMap.prototype.setup;
AppMap.prototype.setup = function () {
	oldSetup.apply(this, arguments);
	this.__readyPromise = can.Deferred();
};

AppMap.prototype.waitFor = function(promise) {
	this.__readyPromises.push(promise);

	promise.then(() => {
		var pIndex = this.__readyPromises.indexOf(promise);
		if (pIndex > -1) {
			this.__readyPromises.splice(pIndex, 1);
		}

		if (this.__readyPromises.length === 0) {
			setTimeout(() => {
				this.__readyPromise.resolve();
			}, 1);
		}
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
