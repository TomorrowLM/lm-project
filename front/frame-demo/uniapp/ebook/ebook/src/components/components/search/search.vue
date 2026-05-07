<template name="search">
	<!-- 搜索功能 -->
	<view class="head">
		<view class="headwrap">
			<image class="searchimg" src="https://img.yohaoyun.com/yohaoyun/tongcheng/search.png"></image>
			 <input type="text" class="searchtext" confirm-type="search" 
			 @confirm="searchcontent" v-model="searchtext"
			 placeholder="输入作者或者书名进行搜索"  maxlength="20" placeholder-class="textstyle"/>
		</view>
	</view>
</template>

<script>
	export default {
		name:"search",
		data() {
			return {
				searchtext:''
			};
		},methods: {
			searchcontent() {
				var me = this;
				me.$emit('search',me.searchtext);
			}
		}
	}
</script>

<style>
@import url("search.css");
</style>
