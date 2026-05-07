### dhImage 图片加载失败显示默认图片

> 介绍
官网已经有<imgae></image>标签了，但是过于局限性，无法设置失败时候显示的默认图片，dhImage组件是在完全保证官方标签和使用的情况下，增加了异常处理。

> 引入组件：

```
import dhImage from '@/components/dh-image/dh-image'

export default {
	components:{
		dhImage
	},
}
```

> 使用组件

```
<dh-image :src="'https://www.xxx.com/images/1.jpg'" errorSrc="https://www.xxx.com/images/default.png"></dh-image>
```

> 属性

属性名 | 类型 | 默认值 | 说明 | 平台差异说明 
-|-|-
src | String | '' | 图片地址 | 无
errorSrc | String | '' | 如果图片无法加载，则默认显示图片地址 | 无
mode | String | 'aspectFill' | 图片裁剪、缩放的模式 | 无

> mode 属性具体详细请看官网
[mode 有效值](https://uniapp.dcloud.io/component/image)
