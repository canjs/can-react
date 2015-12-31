import React from "react";
import ReactDom from "react-dom";
import ReactMarkupChecksum from "react/lib/ReactMarkupChecksum";

import can from 'can/util/';
import route from "can/route/";
import 'can/route/pushstate/';
import 'can-react/extensions/';


// Determine if we are in the browser or server - this could maybe be smarter...
const IS_BROWSER = typeof global === "undefined";

export default function (AppState, AppComponent) {
  function render(appMap, options) {
    options = options || {};

    // When using ReactDomServer.renderToString, react uses a checksum attribute to identify SSR'd content. 
    // If we try to RenderDom directly to the document during SSR, React will bark because
    // it is expecting to bind to a checksum'd element (ask Ryan Wheale (@DesignByOnyx) for full explanation).
    // When rendering server-side, we render to a DIV.
    // This is possible because can-simple-dom will allow an HTML element as a child to a DIV,
    // and this makes React happy.
    var doc = options.document || document;
    var container = IS_BROWSER ? doc : doc.createElement("div");

    if (!IS_BROWSER) {
      doc.body.appendChild(container);
    }

    // Ensure data is an instance of AppState
    // This should really only happen on the client
    if (typeof appMap.attr !== "function") {
      let newMap = new AppState();
      newMap.__pageData = can.extend(true, {}, appMap);
      appMap = newMap;
    }

    route.map(appMap);
    route.ready();
    
    var pageModulePromise = appMap.attr('pageModulePromise').then(() => {
      var app = React.createElement(AppComponent, {appMap: appMap});
      ReactDom.render(app, container);
    });

    appMap.waitFor(pageModulePromise);
  }

  // This is only called on the server
  function renderAsync(renderer, appMap, _, document) {
    //!steal-remove-start
    var start = Date.now();
    can.dev.log("renderAsync called");
    //!steal-remove-end

    // renderer is just a reference to the exported render function above
    renderer(appMap, {document: document});

    return new Promise(function (resolve) {
      appMap.readyPromise().then(function () {
        //!steal-remove-start
        can.dev.log("ALL READY PROMISES RESOLVED IN", Date.now() - start, "MILLISECONDS");
        //!steal-remove-end

        // A timeout is necessary to let react finish rendering asynchronously loaded content
        setTimeout(() => {
          // Fix markup discrepencies b/t what can-simple-dom produces and what react expects
          let html = normalizeMarkup(document.body.firstChild.innerHTML);

          // Add reacts checksum to the markup - this mimics reacts renderToString technique
          // This allows react to mount to the document without complaining or touching the DOM
          html = ReactMarkupChecksum.addChecksumToMarkup(html);

          // can-ssr uses document.body.innerHHTML to send output to browser
          document.body = {
            innerHTML: html
          };

          resolve();
        });
      });
    });
  };

  // Finally, call the render method if we're in the browser
  if (IS_BROWSER) {
    render(typeof INLINE_CACHE === "object" ? INLINE_CACHE : {});
  }

  return {
    viewModel: AppState,
    render: render,
    renderAsync: renderAsync
  };
}

/**
 * When a react component sees a "checksum" attribute on the DOM node to which it is mounting, 
 * it knows that data was rendered on the server - the checksum serves as a hash of the markup.
 * If react can reuse existing HTML, it will and will not touch the DOM. To do this,
 * react takes the state of the app and renders the app to a string in memory and creates a checksum. 
 * This checksum must match EXACTLY the server-side generated checksum. If there is so much as an extra space
 * rendered on the server but not in the client, the checksums wont match and react will bark at you claiming
 * that you are impure and should not exist as a person. The only way I have found to compare the two
 * is to console log the HTML being generated in memory and compare that to the "view source" HTML.
 * The discrepency should be small.
 *
 * The in-memory markup is used in node_modules/react/lib/ReactMount -> _mountImageIntoNode method.
 */
function normalizeMarkup (html) {
  console.log("REPLACING HTML");
  // Make sure self-closing tags actually self-close
  html = html.replace(/<(area|base|br|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)([^>]+)([^\/])>/g, "<$1$2$3/>");
  // Make sure boolean attributes have equals signs and empty value (checked="")
  html = html.replace(/<([a-zA-Z\-]+ (?:.+['"] )?)([a-zA-Z\-]+)([ \>\\])/g, '<$1$2=""$3');
  html = html.replace(/<([a-zA-Z\-]+ (?:.+['"] )?)([a-zA-Z\-]+)([ \>\\])/g, '<$1$2=""$3');
  // Unencode improperly encoded ampersands in front of html entity references
  html = html.replace(/&amp;(#?[a-z0-9]+;)/g, '&$1');
  return html;
}
