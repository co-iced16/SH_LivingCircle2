// 高德地图相关工具函数
export class AmapUtils {
  static map = null
  static geocoder = null
  
  // 初始化地图
  static async initMap(container, options = {}) {
    await this.waitForAmap()
    
    const defaultOptions = {
      zoom: 15,
      center: [121.473701, 31.230416], // 上海市中心
      mapStyle: 'amap://styles/normal'
    }
    
    this.map = new AMap.Map(container, { ...defaultOptions, ...options })
    this.geocoder = new AMap.Geocoder()
    
    return this.map
  }

  // 地理编码（地址转坐标）
  static async geocode(address) {
    await this.waitForAmap()
    
    return new Promise((resolve, reject) => {
      if (!this.geocoder) {
        this.geocoder = new AMap.Geocoder()
      }
      
      this.geocoder.getLocation(address, (status, result) => {
        if (status === 'complete' && result.geocodes.length > 0) {
          const location = result.geocodes[0].location
          resolve({
            longitude: location.lng,
            latitude: location.lat,
            formatted_address: result.geocodes[0].formatted_address
          })
        } else {
          reject(new Error('地理编码失败'))
        }
      })
    })
  }

  // 逆地理编码（坐标转地址）
  static async reverseGeocode(longitude, latitude) {
    await this.waitForAmap()
    
    return new Promise((resolve, reject) => {
      if (!this.geocoder) {
        this.geocoder = new AMap.Geocoder()
      }
      
      const lnglat = new AMap.LngLat(longitude, latitude)
      this.geocoder.getAddress(lnglat, (status, result) => {
        if (status === 'complete' && result.regeocode) {
          resolve({
            formatted_address: result.regeocode.formattedAddress,
            province: result.regeocode.addressComponent.province,
            city: result.regeocode.addressComponent.city,
            district: result.regeocode.addressComponent.district
          })
        } else {
          reject(new Error('逆地理编码失败'))
        }
      })
    })
  }
  
  // 检查AMap是否已加载
  static isAmapLoaded() {
    return typeof AMap !== 'undefined'
  }
  
  // 等待AMap加载
  static waitForAmap() {
    return new Promise((resolve, reject) => {
      if (typeof AMap !== 'undefined') {
        console.log('AMap已加载完成')
        // 验证API key
        this.verifyApiKey()
        resolve(AMap)
        return
      }
      
      console.log('等待AMap加载...')
      let attempts = 0
      const maxAttempts = 50 // 最多等待5秒
      
      const checkAmap = setInterval(() => {
        attempts++
        console.log(`AMap加载检测第${attempts}次...`)
        
        if (typeof AMap !== 'undefined') {
          clearInterval(checkAmap)
          console.log('AMap加载成功')
          // 验证API key
          this.verifyApiKey()
          resolve(AMap)
        } else if (attempts >= maxAttempts) {
          clearInterval(checkAmap)
          console.error('AMap加载超时')
          reject(new Error('AMap加载超时，请检查网络连接或API key是否正确'))
        }
      }, 100)
    })
  }

  // 验证API key是否有效
  static verifyApiKey() {
    try {
      // 创建一个简单的Geocoder来测试API key
      const geocoder = new AMap.Geocoder()
      geocoder.getLocation('北京市', (status, result) => {
        if (status === 'complete') {
          console.log('API key验证成功')
        } else if (status === 'invalid_key') {
          console.error('API key无效，请检查配置')
        } else {
          console.warn('API key验证状态:', status)
        }
      })
    } catch (error) {
      console.error('API key验证失败:', error)
    }
  }

  // 获取当前位置
  static async getCurrentPosition() {
    try {
      // 确保AMap已加载
      await this.waitForAmap()
      
      return new Promise((resolve, reject) => {
        AMap.plugin('AMap.Geolocation', () => {
          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            showButton: false,
            showMarker: false,
            showCircle: false
          })
          
          geolocation.getCurrentPosition((status, result) => {
            if (status === 'complete') {
              resolve({
                longitude: result.position.lng,
                latitude: result.position.lat,
                accuracy: result.accuracy,
                formatted_address: result.formattedAddress || ''
              })
            } else {
              reject(new Error(`定位失败: ${result.message || '未知错误'}`))
            }
          })
        })
      })
    } catch (error) {
      throw new Error(`定位失败: ${error.message}`)
    }
  }
  
  // POI搜索
  static async searchPOI(keyword, options = {}) {
    try {
      await this.waitForAmap()
      
      return new Promise((resolve, reject) => {
        // 检查AMap对象和必要的插件
        if (!window.AMap) {
          reject(new Error('AMap未正确加载'))
          return
        }

        console.log('开始POI搜索, 关键字:', keyword, '选项:', options)
        
        AMap.plugin(['AMap.PlaceSearch'], (err) => {
          if (err) {
            console.error('PlaceSearch插件加载失败:', err)
            reject(new Error(`插件加载失败: ${err.message || '未知错误'}`))
            return
          }
          
          console.log('PlaceSearch插件加载成功')
          
          try {
            const placeSearch = new AMap.PlaceSearch({
              pageSize: options.pageSize || 20,
              pageIndex: options.pageIndex || 1,
              city: options.city || '上海市',
              type: '', // 搜索所有类型
              extensions: 'all' // 返回详细信息
            })
            
            console.log('PlaceSearch实例创建成功, 开始搜索...')
            
            placeSearch.search(keyword, (status, result) => {
              console.log('POI搜索回调:', { 
                status, 
                result, 
                info: result?.info,
                count: result?.poiList?.count || 0 
              })
              
              if (status === 'complete') {
                if (result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
                  const pois = result.poiList.pois.map(poi => ({
                    id: poi.id,
                    name: poi.name,
                    address: poi.address || poi.district + poi.address,
                    location: {
                      lng: parseFloat(poi.location.lng),
                      lat: parseFloat(poi.location.lat)
                    },
                    type: poi.type,
                    distance: poi.distance,
                    district: poi.district,
                    adname: poi.adname
                  }))
                  console.log('处理后的POI数据:', pois)
                  resolve(pois)
                } else {
                  console.log('搜索完成但没有找到结果')
                  resolve([]) // 没有数据时返回空数组
                }
              } else if (status === 'no_data') {
                console.log('没有找到相关POI数据')
                resolve([])
              } else {
                const errorMsg = result?.info || status || '未知错误'
                console.error('POI搜索失败:', { status, result, errorMsg })
                
                // 根据不同的错误状态提供不同的错误信息
                let userFriendlyError = '搜索失败'
                if (status === 'error') {
                  userFriendlyError = '网络连接错误，请检查网络'
                } else if (status === 'invalid_key') {
                  userFriendlyError = 'API密钥无效'
                } else if (status === 'quota_exceeded') {
                  userFriendlyError = '搜索次数超限，请稍后再试'
                } else if (status === 'invalid_request') {
                  userFriendlyError = '搜索参数无效'
                }
                
                reject(new Error(`${userFriendlyError}: ${errorMsg}`))
              }
            })
          } catch (error) {
            console.error('创建PlaceSearch实例时出错:', error)
            reject(new Error(`创建搜索实例失败: ${error.message}`))
          }
        })
      })
    } catch (error) {
      console.error('POI搜索异常:', error)
      throw new Error(`POI搜索异常: ${error.message}`)
    }
  }
  
  // 使用HTTP REST API进行地址搜索
  static async searchAddress(address, options = {}) {
    try {
      console.log(`开始地理编码: ${address}`)
      
      // 使用高德Web服务API进行地理编码
      const apiKey = 'c1e16b086f32deeb23220fa56172a151' // 您的API key
      const baseUrl = 'https://restapi.amap.com'
      
      const response = await fetch(`${baseUrl}/v3/geocode/geo?` + new URLSearchParams({
        key: apiKey,
        address: address,
        city: options.city || '上海', // 默认限制在上海市
        output: 'JSON'
      }), {
        method: 'GET',
        timeout: 15000 // 15秒超时
      })

      const data = await response.json()
      console.log('地理编码响应:', data)

      if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
        const results = data.geocodes.map((geocode, index) => {
          const location = geocode.location.split(',')
          return {
            id: `api_geocode_${index}`,
            name: address,
            address: geocode.formatted_address || address,
            location: {
              lng: parseFloat(location[0]),
              lat: parseFloat(location[1])
            },
            type: 'REST API地址',
            province: geocode.province || '',
            city: geocode.city || '',
            district: geocode.district || '',
            township: geocode.township || '',
            adcode: geocode.adcode || '',
            level: geocode.level || ''
          }
        })
        
        console.log(`地理编码成功: ${address} ->`, results)
        return results
      }
      
      console.warn(`地理编码失败: ${address}, 响应状态: ${data.status}, 信息: ${data.info}`)
      return []
      
    } catch (error) {
      console.error('地理编码请求失败:', {
        address,
        error: error.message
      })
      return []
    }
  }
  
  // 计算路径时间
  static calculateRouteTime(origin, destination, mode = 'walking') {
    return new Promise((resolve, reject) => {
      let service
      
      switch (mode) {
        case 'walking':
          AMap.plugin('AMap.Walking', () => {
            service = new AMap.Walking()
            service.search(origin, destination, (status, result) => {
              if (status === 'complete') {
                const route = result.routes[0]
                resolve({
                  distance: route.distance,
                  time: route.time
                })
              } else {
                reject(new Error('步行路径规划失败'))
              }
            })
          })
          break
          
        case 'transit':
          AMap.plugin('AMap.Transfer', () => {
            service = new AMap.Transfer({
              city: '上海'
            })
            service.search(origin, destination, (status, result) => {
              if (status === 'complete') {
                const plan = result.plans[0]
                resolve({
                  distance: plan.distance,
                  time: plan.time
                })
              } else {
                reject(new Error('公交路径规划失败'))
              }
            })
          })
          break
          
        case 'driving':
          AMap.plugin('AMap.Driving', () => {
            service = new AMap.Driving()
            service.search(origin, destination, (status, result) => {
              if (status === 'complete') {
                const route = result.routes[0]
                resolve({
                  distance: route.distance,
                  time: route.time
                })
              } else {
                reject(new Error('驾车路径规划失败'))
              }
            })
          })
          break
          
        default:
          reject(new Error('不支持的出行方式'))
      }
    })
  }
  
  // 添加标记点
  static addMarker(map, position, options = {}) {
    const marker = new AMap.Marker({
      position: new AMap.LngLat(position.longitude, position.latitude),
      ...options
    })
    
    map.add(marker)
    return marker
  }
  
  // 添加圆形范围
  static addCircle(map, center, radius, options = {}) {
    const circle = new AMap.Circle({
      center: new AMap.LngLat(center.longitude, center.latitude),
      radius: radius,
      fillColor: options.fillColor || '#1890ff',
      fillOpacity: options.fillOpacity || 0.2,
      strokeColor: options.strokeColor || '#1890ff',
      strokeWeight: options.strokeWeight || 2
    })
    
    map.add(circle)
    return circle
  }
}

// 工具函数
export const formatTime = (seconds) => {
  // 如果时间为0或无效，返回"1分钟"避免显示0秒
  if (!seconds || seconds === 0) {
    return '1分钟'
  }
  
  if (seconds < 60) {
    return `${seconds}秒`
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}分钟`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    return `${hours}小时${minutes}分钟`
  }
}

export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${meters}米`
  } else {
    return `${(meters / 1000).toFixed(1)}公里`
  }
}

export const getScoreColor = (score) => {
  if (score >= 80) return '#52c41a'
  if (score >= 60) return '#faad14'
  if (score >= 40) return '#fa8c16'
  return '#f5222d'
}

export const getScoreDescription = (score) => {
  if (score >= 80) return '非常便利'
  if (score >= 60) return '比较便利'
  if (score >= 40) return '一般便利'
  return '不太便利'
}
