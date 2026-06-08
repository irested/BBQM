const Image = require("@11ty/eleventy-img");

module.exports = function(eleventyConfig) {
  // Passthrough copy for assets and css
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/assets");

  // Image shortcode
  eleventyConfig.addNunjucksAsyncShortcode("image", async function(src, alt, sizes, className = "", loading = "lazy") {
    // If it's a relative path starting with /, prepend ./src
    let fullSrc = src;
    if (src.startsWith("/")) {
      fullSrc = `./src${src}`;
    }

    let metadata = await Image(fullSrc, {
      widths: [300, 600, 1200, 2000],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
    });

    let imageAttributes = {
      alt,
      sizes,
      loading,
      decoding: "async",
      class: className
    };

    return Image.generateHTML(metadata, imageAttributes);
  });




  
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};

