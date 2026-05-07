import BaseRequest from "./BaseRequest";
var app = getApp();
class CategoryRequest extends BaseRequest {
  /**
   * 获取分类列表
   */
  getCategories(sex, user, success) {
    this.get(app.globalData.config.category.categories + `?sex=${sex} `, user, success);
  }
  /**
   * 获取分类详情
   */
 

}

export default CategoryRequest;