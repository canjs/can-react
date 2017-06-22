import connect from "can-connect";
import sortedSetJSON from "can-connect/helpers/sorted-set-json";

/**
 * This makes a completely synchronous chain of "thennable" objects. This violates the
 * A+ Promise spec which mandates that all promise resolutions must be async no matter what.
 * This is generally bad, but we need it when data is fetched from the INLINE_CACHE,
 * and throughout the initial render() cycle on initial page load.
 * This is all because the React render cycle is synchronous - when we fetch data
 * for the first time, it needs to be available immediately. This is an alternative
 * to having to store all data in the app state and pass it down to each component and
 * it allows individual modules to be autonomous.
 *
 * NOTE: THIS IS NOT A FULL ON IMPLEMENTATION OF THE PROMISE OBJECT. IT IS INTENDED TO
 * BE USED IN SUTUATIONS WHERE YOU WOULD RETURN A RESOLVED PROMISE:
 *
 * if (someDataIsImmediatelyAvailable) {
 * 		return SyncPromise.resolve(data);
 * }
 */
class SyncPromise {
	constructor (fn) {
		fn((data) => {
			this.__data = data;
			return this;
		});
	}

	static resolve (data) {
		return new SyncPromise((resolver) => {
			resolver(data);
		});
	}

	then (fn) {
		var ret = fn(this.__data);

		// If the returned object is thennable, return it - it may be async
		if (ret && ((ret instanceof Promise) || typeof ret.then === "function")) {
			return ret;
		} else {
			return SyncPromise.resolve(ret);
		}
	}

	catch () {
		return this;
	}

	// done and fail are not A+ - but canjs checks these in some of its duck typing
	done (fn) {
		fn(this.__data);
		return this;
	}
	fail () {
		return this;
	}
}

export default connect.behavior("data-inline-cache", (baseConnect) => {
	if(typeof INLINE_CACHE === "undefined") {
		// do nothing if no INLINE_CACHE when this module loads.  INLINE_CACHE has to be before steal.
		return {};
	}

	function getData (id) {
		var type = window.INLINE_CACHE[this.name];
		if(type) {
			var data = type[id];
			if( data ) {
				// delete so it can't be used again
				delete type[id];
				return data;
			}
		}
	}

	return {
		getListData (set) {
			var id = sortedSetJSON(set);
			var data = getData.call(this, id);

			if(data !== undefined) {
				if(this.cacheConnection) {
					this.cacheConnection.updateListData(data, set);
				}

				return SyncPromise.resolve(data);
			} else {
				return baseConnect.getListData.apply(this, arguments);
			}
		},

		getData (params) {
			var id = sortedSetJSON(params);
			var data = getData.call(this, id);
			if(data !== undefined) {
				if(this.cacheConnection) {
					this.cacheConnection.updateData(data);
				}

				return SyncPromise.resolve(data);
			} else {
				return baseConnect.getData.apply(this, arguments);
			}
		}
	};
});
