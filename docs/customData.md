# Custom Data for CSS Language Service

In VS Code, there are two ways of loading custom CSS datasets:

1. With setting `css.experimental.customData`
2. With an extension that contributes `contributes.css.experimental.customData`

Both setting point to a list of JSON files. This document describes the shape of the JSON files.

## Custom Data Format

The JSON can have 4 top level properties:

```jsonc
{
	"properties": [],
	"atDirectives": [],
	"pseudoClasses": [],
	"pseudoElements": []
}
```

They all share two basic properties, `name` and `description`. For example

```jsonc
{
	"properties": [
		{ "name": "foo", "description": "Foo property" }
	],
	"atDirectives": [
		{ "name": "@foo", "description": "Foo at directive" }
	],
	"pseudoClasses": [
		{ "name": ":foo", "description": "Foo pseudo class" }
	],
	"pseudoElements": [
		{ "name": ":foo", "description": "Foo pseudo elements" }
	]
}
```