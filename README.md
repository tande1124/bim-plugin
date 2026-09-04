# $

本项目基于英思Vanadium2框架开发

请先配置 src/runtime-config.js

```javascript

{
    plugins: [
        require('@ins/vam2-plugin-tanggula/src/runtime-config')
    ]

    appConfig: {
        appCode:    '<appCode>',    // 必填
        appName:    '<appName>',    // 必填
        moduleCode: '<moduleCode>', // 必填
        moduleName: '<moduleName>', // 必填
    },
}

```

然后配置 public/app-config.js，用于部署时灵活调整

```javascript

{

    apiBaseURL: {
        System: 'xxxx',
    },
}

```
