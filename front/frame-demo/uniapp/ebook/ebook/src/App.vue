<script>
	import keepdata from './util/util.js'
	export default {
		onLaunch: function() {
			const that = this;
			uni.getSystemInfo({
					success(res) {
						that.globalData.statusBarHeight = res.statusBarHeight;
					}
				})
				let a = this.$store.state.bookshelf;
				 a = uni.getStorageSync('bookshelf')
				 this.$store.state.bookshelf = a; 
				keepdata(this.$store.state.bookshelf,'bookshelf')
				 let b = this.$store.state.bookReadAddress;
				 b = uni.getStorageSync('bookReadAddress')
				 this.$store.state.bookReadAddress = b;
				// let c = this.$store.state.localbookshelf; 
				// c = uni.getStorageSync('localbookshelf')
				// this.$store.state.localbookshelf = c;
				//  uni.removeStorageSync('localbookshelf');
				// console.log(this.$store.state.localbookshelf) 
		},
		onShow: function() {

		},
		onHide: function() { 
			let a =this.$store.state.bookshelf
			uni.setStorage({
			    key: 'bookshelf',
			    data: a,
			    success: function () {
			    },
			}) 
			let b =this.$store.state.localbookshelf
			console.log(b)
			uni.setStorage({
			    key: 'localbookshelf',
			    data: b,
			    success: function () {
			    },
			}) 

		},
		onInit: () => {
			
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
