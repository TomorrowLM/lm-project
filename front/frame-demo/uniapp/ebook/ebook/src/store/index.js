import Vue from 'vue'
import Vuex from 'vuex'
import persistedState from 'vuex-persistedstate'
Vue.use(Vuex)

const store = new Vuex.Store({
  // plugins:[persistedState()],
  state: {
	username:'liming',
	image:'',
		// image:'@/static/book.jpeg',
	//书架的书籍
    bookshelf: new Array(),
	//是否展示本地文件弹框
	isShowInbook:false,
	//是否展示删除书籍弹框
	isDeleteInbook:false,
	//是否将收藏书籍添加
	isCollectbook:false,
	isShowInMineClear:false,
	fixSecurity:false,
	bookReadAddress: new Array(),
	address:'',
	//添加本地书籍名称
	bookSelectName:'12',
	//本地书籍
	localbookshelf:new Array(),
	//加入收藏
	collectBook:new Array(),
  },
  mutations: {
	bookdetailaddbook(state, obj){
		 //  console.log(typeof state.bookshelf)
		 // state.bookshelf = state.bookshelf.split('')
		  // state.bookshelf.push(obj)
	  },
	bookshelfActive(state, obj){
		// JSON.parse(state.bookshelf)
		console.log(obj) 
		state.bookshelf.push(obj);
		uni.setStorage({
		    key: 'bookshelf',
		    data: state.bookshelf,
		    success: function () {
		        console.log('success');
		    }
		}),
		uni.request({
			url:'http://api.pingcc.cn/fictionChapter/search/'+obj.fictionId,
						success:(res)=>{
							state.bookReadAddress.push({'fictionId':obj.fictionId,'bookReadAddress':res.data.data.data[0].chapterId})
							uni.setStorageSync('bookReadAddress', state.bookReadAddress);		
						}
		})   
		console.log(state.bookReadAddress)
	},
	bookshelfClear(state, obj){
		state.bookshelf = obj
		state.localbookshelf = obj
		state.bookReadAddress = obj
		uni.setStorageSync('bookshelf', obj);
		uni.setStorageSync('localbookshelf', obj);
		uni.setStorageSync('bookReadAddress', obj);
	}, 
	bookReadAddress1(state , n){
		state.bookReadAddress.forEach((value,index)=>{
			if(value.fictionId == n[0]){
				value.bookReadAddress = n[1]
			}
		})
	},
	chooseImage(state , n){
		state.image = n  
		state.image = JSON.parse(state.image)
		// console.log(typeof state.image)
	},
	addressActive(state , n){
		state.address = n 
	},
	bookSelectNameActive(state , n){
		state.bookSelectName = n[0] 
		state.localbookshelf.push(n)
		uni.setStorage({
		    key: 'localbookshelf',
		    data: state.localbookshelf,
		    success: function () {
		    },
		}) 
	},
	clearlocalbookshelf(state){
		console.log(123)
		state.localbookshelf.pop()
		console.log(state.localbookshelf)
	},
	collect(state , n){
		state.collectBook.push(n)
	},
	addCollectToshelf(state , n){
		state.collectBook.forEach((value)=>{
			if(value.fictionId==n){
				state.bookshelf.unshift(value)
			}
		})
	}
  } 
})
export default store