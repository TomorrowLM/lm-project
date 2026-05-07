<script>
	export default {
		onLaunch: function () {
			console.log('App Launch')
			// #ifdef APP-PLUS
			// 锁定屏幕方向
			plus.screen.lockOrientation('portrait-primary'); //锁定
			// #endif
		},
		onShow: function () {
			console.log('App Show')
		},
		onHide: function () {
			console.log('App Hide')
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
