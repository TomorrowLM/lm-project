<template>
    <div>
        	<uni-drawer ref="showLeft" mode="right" :width="180" @change="change($event,'showLeft')">
					<button @click="goToMine">我的</button>					
					<view class="close">
						<view class="word-btn" hover-class="word-btn--hover" :hover-start-time="20" :hover-stay-time="70" @click="closeDrawer('showLeft')"><text class="word-btn-white">关闭</text></view>
					</view>
				</uni-drawer>
        <view>
            <uni-fab
            class ='fontSize'
            :pattern="pattern"
            :content="content"
            :horizontal="horizontal"
            :vertical="vertical"
            :direction="direction"
            :popMenu=true
            @trigger="trigger"
            > </uni-fab>
        </view>
    </div>
</template>
<script>
import uniFab from '@/components/uni-fab/uni-fab.vue';
import uniDrawer from "@/components/uni-drawer/uni-drawer.vue"
export default {
    data(){
        return {
            pattern:{
                color:'green'
            },
            content:[
                {text:'',color:'green'},
                {text:'2'}
            ],
            horizontal:'right',
            vertical:'bottom',
            direction:'horizontal'
        }
    },
    methods:{
        showDrawer(e) {
				this.$refs[e].open()
			},
			// 关闭窗口
		closeDrawer(e) {
				this.$refs[e].close()
			},
			// 抽屉状态发生变化触发
		change(e, type) {
				console.log((type === 'showLeft' ? '左窗口' : '右窗口') + (e ? '打开' : '关闭'));
				this[type] = e
			},
        open(){
         this.$refs.popup.open()
      }
    },
    components:{uniFab}
}
</script>
<style >
    .fontSize{
        font-size:26px;
    }
</style>