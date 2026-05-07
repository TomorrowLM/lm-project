import BaseRequest from "./BaseRequest";
var app = getApp();

class RankRequest extends BaseRequest {
  /**
   * 获取排行榜列表
   */
  getRanks(sex, user, success) {
    this.get(app.globalData.config.rank.rank_categories + "?sex=" + sex, user, success);
  }
  /**
   * 获取排行榜详情
   */


}

export default RankRequest;