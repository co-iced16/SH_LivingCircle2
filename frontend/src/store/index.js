import { createStore } from 'vuex'
import auth from './modules/auth'
import facilities from './modules/facilities'
import feedback from './modules/feedback'
import evaluation from './modules/evaluation'

export default createStore({
  modules: {
    auth,
    facilities,
    feedback,
    evaluation
  }
})
