# Custom Data for CSS Language Service

In VS Code, there are two ways of loading custom CSS datasets:

1. With setting `css.experimental.customData`
2. With an extension that contributes `contributes.css.experimental.customData`

Both setting point to a list of JSON files. This document describes the shape of the JSON files.

## Custom Data Format

🚧 The data format is in experimental phase and subject to change. 🚧

The JSON can have 4 top level properties:

```jsonc
{
	"properties": [],
	"atDirectives": [],
	"pseudoClasses": [],
	"pseudoElements": []
}
```

You can find their shapes at [cssLanguageTypes.ts](../src/cssLanguageTypes.ts) or the [JSON Schema](./customData.schema.json).

They all share two basic properties, `name` and `description`. For example:

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

You can also specify 2 additional properties for them:

```jsonc
{
	"properties": [
		{
			"name": "foo",
			"description": "Foo property",
			"browsers": [
				"E12",
				"S10",
				"C50",
				"IE10",
				"O37"
			],
			"status": "standard"
		}
	]
}
```

- `browsers`: A list of supported browsers. The format is `browserName + version`. For example: `['E10', 'C30', 'FF20']`. Here are all browser names:
	```
	export let browserNames = {
		E: 'Edge',
		FF: 'Firefox',
		S: 'Safari',
		C: 'Chrome',
		IE: 'IE',
		O: 'Opera'
	};
	```
	The browser compatibility will be rendered at completion and hover. Items that is only supported in only one browser are dropped from completion.

- `status`: The status of the item. The format is:
	```
	export type EntryStatus = 'standard' | 'experimental' | 'nonstandard' | 'obsolete';
	```
	The status will be rendered at the top of completion and hover. For example, `nonstandard` items are prefixed with the message `🚨️ Property is nonstandard. Avoid using it.`.