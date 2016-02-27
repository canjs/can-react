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
const noop = function () { };

export default function (AppComponent) {
  //!steal-remove-start
  if (AppComponent.prototype.getInitialState) {
    throw new Error ("You cannot use getInitialState on the app component. The server side rendering engine will instatiate your app's viewmodel and set the state accordingly. If you need custom initialization logic, use the viewmodel init() function or any of the other React Component lifecycle events.");
  }
  if (!AppComponent.prototype.ViewModel) {
    throw new Error ("Your app component must have a ViewModel property on its prototype. The ViewModel must be a can.Map constructor.")
  }
  //!steal-remove-end
  
  var AppState = AppComponent.prototype.ViewModel;
  function render(appState, options) {
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
    if (typeof appState.attr !== "function") {
      appState = new AppState();
    }

    route.map(appState);
    route.ready();

    var oldUnMount = AppComponent.prototype.componentWillUnmount;
    AppComponent.prototype.componentWillUnmount = function () {
      appState.unbind("pageModulePromise", noop);
      oldUnMount.apply(this, arguments);
    };
    appState.bind("pageModulePromise", noop);
    
    var pageModulePromise = appState.attr('pageModulePromise').then(() => {
      var app = React.createElement(AppComponent, { __initialState: appState });
      ReactDom.render(app, container);
    });

    appState.waitFor(pageModulePromise);
  }

  // This is only called on the server
  function renderAsync(renderer, appState, _, document) {
    //!steal-remove-start
    var start = Date.now();
    can.dev.log("renderAsync called");
    //!steal-remove-end

    // renderer is just a reference to the exported render function above
    renderer(appState, {document: document});

    return new Promise(function (resolve) {
      appState.readyPromise().then(function () {
        //!steal-remove-start
        can.dev.log("ALL READY PROMISES RESOLVED IN", Date.now() - start, "MILLISECONDS");
        //!steal-remove-end

        // A timeout is necessary to let react finish rendering asynchronously loaded content
        setTimeout(() => {
          let html = document.body.firstChild.innerHTML;

          // Add reacts checksum to the markup - this mimics reacts renderToString technique
          // This allows react to mount to the document without complaining or touching the DOM
          html = ReactMarkupChecksum.addChecksumToMarkup(html);
          html = html.replace('</body>', '<script>var INLINE_CACHE = ' + JSON.stringify(appState.__pageData) + ';</script></body>');

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
    render,
    renderAsync
  };
}
