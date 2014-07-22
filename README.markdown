Prolog
======

This was taken from the good work of Sergey Ilinsky. Thanks for the leg up!

My needs were to create a lower level method of retrying an XMLHttpRequest. The retry needed to reside in library
form and interact with the software we're using well enough.

Changes from the original:
1) remove any IE specific code - we're dealing with webkit browsers only
2) use XMLHttpRequest.wrapped if it exists always (tested using Chrome and Firefox)
3) enabled the queues
4) added support for .onload() compatibility
5) added minified versions

Hopefully this is useful to someone.

Scope of implementation
=====

1. Deliver unobtrusive standard-compliant cross-browser implementation of the
   [XMLHttpRequest 1.0][1]
2. Fix browsers quirks observed in their native XMLHttpRequest object implementations
3. Enable transparent sniffing of XMLHttpRequest object activity

How To Use
=====

```html
<head>
    <!-- ... -->
    <script type="text/javascript" src="XMLHttpRequest.js"></script>
    <!-- ... -->
</head>
```

XMLHttpRequest 2 features
=====

The library does not and will not add support for any features found in [XMLHttpRequest 2][2] since
it is not possible to provide complete fallback implementation in older Internet Explorer browser
for which this library was primarily developed. If you use this library, I recommend starting adding
conditional HTML comments to limit exposure of the library only to browsers where it is really needed.

```html
<head>
    <!--[if lte IE 9]>
    <script type="text/javascript" src="XMLHttpRequest.js"></script>
    <![endif]-->
</head>
```



Links to online resources
=====

1. [XMLHttpRequest object implementation explained][3]
2. [XMLHttpRequest 1.0 specification][1]

[1]: http://www.w3.org/TR/2007/WD-XMLHttpRequest-20071026/
[2]: http://www.w3.org/TR/XMLHttpRequest/
[3]: http://www.ilinsky.com/articles/XMLHttpRequest