const ProductVideo = require('../../database/models/ProductVideo');

// @desc    Get all active product videos for salesman
// @route   GET /api/salesman/product-videos
// @access  Private/Salesman
const getMyProductVideos = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = { isActive: true }; // Only show active videos

    if (category && category !== 'All') {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const videos = await ProductVideo.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching product videos',
    });
  }
};

// @desc    Get single product video
// @route   GET /api/salesman/product-videos/:id
// @access  Private/Salesman
const getMyProductVideo = async (req, res) => {
  try {
    const video = await ProductVideo.findOne({
      _id: req.params.id,
      isActive: true, // Only return if active
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Product video not found or not available',
      });
    }

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching product video',
    });
  }
};

module.exports = {
  getMyProductVideos,
  getMyProductVideo,
};
