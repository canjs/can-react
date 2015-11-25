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
export default class SyncPromise {
	constructor (fn) {
		this._id = Math.random();
		fn((data) => {
			this.__data = data;
			return this;
		})
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

	done (fn) {
		fn(this.__data);
		return this;
	}
	fail (fn) {
		return this
	}
}
