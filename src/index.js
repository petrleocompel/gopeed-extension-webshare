// Entry point of the Gopeed extension: registers the resolver for
// webshare.cz links (see manifest.json for the URL patterns).
import { onResolve } from './resolve.js';
import { onStart } from './start.js';

gopeed.events.onResolve(onResolve);
gopeed.events.onStart(onStart);
