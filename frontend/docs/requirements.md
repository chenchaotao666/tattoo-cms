1、参照backend/docs/database.sql这个数据库的设计
2、这是frontend这是一个基于Ant Design Pro创建的前端基础页面
3、帮我构建以下界面：
1. 前端frontend一个生成分类的页面（包括新增、修改、删除、查询功能），对应数据库的categories表，后端可以基于backend/src/routes/categoryRoutes.js进行完善。
2. 前端frontend一个生成tags的页面（包括新增、修改、删除、查询功能），对应数据库的tags表，后端可以基于backend/src/routes/tagRoutes.js进行完善。

参考frontend/src/pages/categories的页面功能，帮我创建
1. 前端frontend一个生成styles的页面（包括新增、修改、删除、查询功能），对应数据库的styles表，后端可以基于backend/src/routes/styleRoutes.js进行完善。
2. 前端frontend一个生成ideas的页面（包括新增、修改、删除、查询功能），对应数据库的ideas表，后端可以基于backend/src/routes/ideaRoutes.js进行完善。


参考frontend/src/pages/categories的页面功能，帮我创建
1. 前端frontend一个生成images的页面（包括新增、修改、删除、查询功能），对应数据库的backend/docs/database.sql的images表，后端可以基于backend/src/routes/imageRoutes.js进行完善。
新增页面需要有生成纹身图片的功能，生成纹身图片后台是：backend/src/services/ImageGenerateService.js。