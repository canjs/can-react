import connect from "can-connect";
import sortedSetJSON from "can-connect/helpers/sorted-set-json";
import SyncPromise from '../util/SyncPromise';

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
