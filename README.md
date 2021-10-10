# Frontify Authenticator v2

Authenticate to your Frontify instance from within any secure web app.

# Install

There are three possible ways of installing or requiring the Frontify Authenticator v2.

## NPM

Installing the latest published package on a third party app is as simple as running `npm i @frontify/frontify-authenticator` and requiring the main class either via CommonJs or as an ES module.

```
// CommonJs require
const FrontifyAuthenticator = require('@frontify/frontify-authenticator');
```

OR

```
// ESM import
import { authorize, refresh, revoke } from '@frontify/frontify-authenticator';
```

## CDN

Alternatively, in case you're not relying on npm packages in your web app, you can also require the minified JS script directly by using a CDN such as UPAKG. You can find the latest [Frontify Authenticator v2 source code](https://unpkg.com/@frontify/frontify-authenticator@latest/dist/index.js) and import it to your project you by requiring it via a `<script>` HTML element.

```
<script src="https://unpkg.com/@frontify/frontify-authenticator@latest/dist/index.js"></script>
```

You may want to require a specific version. To do so you only have to change the word `latest` with the specific version you wish to use (ie. v2.0.0).

To make use of the available methods in the script all you have to do is use the `FrontifyAuthenticator` object reference attached to the `window`.

Example:

```
FrontifyAuthenticator.authorize(...);
```

or

```
window.FrontifyAuthenticator.authorize(...);
```

## LOCAL

To install any package locally doesn't differ greatly from the CDN use case. You can use the [link mentioned above](https://unpkg.com/@frontify/frontify-authenticator@latest/dist/index.js) to download the file contents, save it to your local instance and require via `<script>` HTML element making the `src` address point to your local file.

```
<script src="<PATH_TO_FILE>/<FILENAME>.js"></script>
```

Like mentioned in the CDN case, if may want to require a specific version, all you have to do is change the word `latest` with the specific version you wish to use (ie. v2.0.0).

You must be aware that, in this case, the latest code won't be automatically updated so it relies on manual downloads everytime you want to have a new version come into effect within your web app.
