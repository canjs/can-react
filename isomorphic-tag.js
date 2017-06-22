import React from 'react';

/**
 * @module IsomorphicTag IsomorphicTag
 *
 * React restricts its component unmount functions to the least common
 * denominator. It will not unmount components with html, head, or body in its
 * tree because of "cross-browser quirks".
 * However, on the server -- where there are no "cross-browser quirks" -- we
 * must prevent React's internal references (e.g. instancesByReactRootID)
 * from continually growing with every page request. We have no choice but to
 * unmount root components on the server.
 * To work around this, we won't use html, head, or body tags when rendering
 * React on the server. `autorender` will transform its response into a valid
 * html document based on the document structure.
 *
 * e.g. root document structure:
 * ```
 * <div>  --> <html>
 *   <div>  --> <head>
 *   </div> --> </head>
 *   <div>  --> <body>
 *   </div> --> </body>
 * </div> --> </html>
 * ```
 */
export default React.createClass({ // eslint-disable-line react/no-deprecated
	render() {
		const isServer = typeof process === 'object' && {}.toString.call(process) === '[object process]';
		const tag = isServer ? 'div' : this.props['data-node'];
		const attributes = Object.keys(this.props).reduce((aggregate, key) => {
			if (key !== 'children') {
				aggregate[key] = this.props[key];
			}

			return aggregate;
		}, {});

		return React.createElement(tag, attributes, this.props.children);
	}
});
