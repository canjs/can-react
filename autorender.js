import React from "react";
import ReactDom from "react-dom";
import ReactMarkupChecksum from "react/lib/ReactMarkupChecksum";

import can from 'can/util/';
import vdoc from 'can/util/vdom/document/';
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
      // This condition can be removed once things are stable using CanJS v2.3.15+
      // We should just be able to add the serializer directly without checking.
      if (doc.__addSerializerAndParser) {
        doc.__addSerializerAndParser(vdoc.__serializer, vdoc.__parser);
      }
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
          let html = document.body.firstChild.innerHTML;

          // Add reacts checksum to the markup - this mimics reacts renderToString technique
          // This allows react to mount to the document without complaining or touching the DOM
          html = ReactMarkupChecksum.addChecksumToMarkup(html);
          html = html.replace('</body>', '<script>var INLINE_CACHE = ' + JSON.stringify(appMap.__pageData) + ';</script></body>');

          // Write the component cache to the output (see can-react component)
          if (typeof window !== "undefined" && window.COMPONENT_CACHE) {
            html = html.replace("</body>", "<script>var COMPONENT_CACHE = " + JSON.stringify(window.COMPONENT_CACHE) + ";</script></body>")
          }

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
