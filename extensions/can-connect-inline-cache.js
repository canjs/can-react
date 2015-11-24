import connect from "can-connect";
import sortedSetJSON from "can-connect/helpers/sorted-set-json";

export default connect.behavior("data-inline-cache", (baseConnect) => {
	if(typeof INLINE_CACHE === "undefined") {
		// do nothing if no INLINE_CACHE when this module loads.  INLINE_CACHE has to be before steal.
		return {};
	}
	
	function getData (id) {
		var type = INLINE_CACHE[this.name];
		window.cache2 = INLINE_CACHE;
		if(type) {
			var data = type[id];
			if( data ) {
				// delete so it can't be used again
				delete type[id];
				return data;
			}
		}
	}

	/**
	 * This makes a completely synchronous chain of "thennable" objects.
	 * This is generally bad, but we need it when data is fetched from the INLINE_CACHE.
	 * This is all because the React render cycle is synchronous - when we fetch data
	 * for the first time, it needs to be available immediately. This is an alternative
	 * to having to store all data in the app state and pass it down to each component.
	 */
	class SyncPromise {
		constructor (fn) {
			this._id = Math.random();
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
			
			// If the returned object is thennable, return it
			if (ret && ((ret instanceof Promise) || typeof ret.then === "function")) {
				return ret;
			} else {
				return SyncPromise.resolve(ret);
			}
		}

		done (fn) {
			fn(this.__data);
			return this;
		}
		fail () {
			return this;
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
			var id = this.id(params);
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
