// @ts-check
import jquery from "jquery";
import localforage from "localforage";
import md5 from "blueimp-md5";
import Toastify from "toastify-js";
import Viewer from "viewerjs";
import { TabulatorFull } from "tabulator-tables";

Object.assign(globalThis, { $: jquery, jQuery: jquery, localforage, md5, Toastify, Viewer, Tabulator: TabulatorFull });
// Layer is a browser-global library. The build emits it before each document entry.
