### Prerequisition

To start with the development of new features for this project you first need to set up your developer environment by installing the following software:
- Nodejs
- Python
- Visual Studio (with C++ core features!)
- Visual Studio Build Tools

### Commands

**_Init_**

This will install build tools

```
npm install --global windows-build-tools
```

This will install all dependencies and rebuild node-sass for your environment. After running this once, you can use the other commands listed below.

```
npm run init
```

**_Update_**

This will update the versions of the dependencies in the `package.json` and install them afterwards.

```
npm run update
```

**_Release_**

This will create a minified version of the source code and place it in a folder `__dist`.

```
npm run release
```

**_SCSS_**

This will parse the scss files to create the css files.

```
npm run scss
```