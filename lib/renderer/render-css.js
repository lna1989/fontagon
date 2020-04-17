const fs = require('fs')
const crypto = require('crypto')
const handlebars = require('handlebars')
const urlJoin = require('url-join')

/**
 * calcHash
 *
 * @param options
 * @returns {PromiseLike<ArrayBuffer>}
 */
function calcHash (options) {
  const hash = crypto.createHash('md5')

  options.files.forEach((file) => {
    hash.update(fs.readFileSync(file, 'utf8'))
  })

  hash.update(JSON.stringify(options))

  return hash.digest('hex')
}

/**
 * makeSrc
 *
 * @param options
 * @param urls
 * @returns {string}
 */
function makeSrc (options, urls) {
  const templates = {
    eot: _.template('url("<%= url %>?#iefix") format("embedded-opentype")'),
    woff2: _.template('url("<%= url %>") format("woff2")'),
    woff: _.template('url("<%= url %>") format("woff")'),
    ttf: _.template('url("<%= url %>") format("truetype")'),
    svg: _.template('url("<%= url %>#<%= fontName %>") format("svg")')
  }

  const orderedTypes = _.filter(options.order, (type) => {
    return options.types.indexOf(type) !== -1
  })

  const src = _.map(orderedTypes, (type) => {
    return templates[type]({
      url: urls[type],
      fontName: options.fontName
    })
  }).join(',\n')

  return src
}

/**
 * makeCtx
 *
 * @param options
 * @param urls
 * @returns {*}
 */
function makeCtx (options, urls) {
  const codepoints = _.zipObject(_.map(options.codepoints, (codepoint, name) => {
    return [name, codepoint.toString(16)]
  }))

  return _.assignIn({
    fontName: options.fontName,
    src: makeSrc(options, urls),
    codepoints
  }, options.templateOptions)
}

/**
 * makeUrls
 *
 * @param options
 * @returns {{}}
 */
function makeUrls (options) {
  const hash = calcHash(options)
  const baseUrl = options.cssFontsUrl && options.cssFontsUrl.replace(/\\/g, '/')
  const urls = _.map(options.types, (type) => {
    const fontName = `${options.fontName}.${type}?${hash}`

    return baseUrl
      ? urlJoin(baseUrl, fontName)
      : fontName
  })

  return _.zipObject(options.types, urls)
}

/**
 * export
 * @param options
 * @param urls
 * @returns {*}
 */
export default function (options, urls) {
  if (typeof urls === 'undefined') {
    urls = makeUrls(options)
  }

  const ctx = makeCtx(options, urls)
  const source = fs.readFileSync(options.cssTemplate, 'utf8')
  const template = handlebars.compile(source)

  return template(ctx)
}