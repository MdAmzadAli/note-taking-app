
const cloudinaryService = require('./services/cloudinaryService');

async function testCloudinaryConfig() {
  console.log('🔍 Testing Cloudinary Configuration...\n');

  // Check if environment variables are set
  console.log('1. Environment Variables:');
  console.log(`   CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_KEY: ${process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_SECRET: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  // Check if service is configured
  console.log('2. Service Configuration:');
  const isConfigured = cloudinaryService.isConfigured();
  console.log(`   Status: ${isConfigured ? '✅ Configured' : '❌ Not Configured'}`);
  console.log('');

  if (!isConfigured) {
    console.log('❌ Cloudinary is not properly configured!');
    console.log('Please check your .env file in the backend folder.');
    console.log('Required variables:');
    console.log('   CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('   CLOUDINARY_API_KEY=your_api_key');
    console.log('   CLOUDINARY_API_SECRET=your_api_secret');
    return;
  }

  console.log('✅ Cloudinary configuration looks good!');
  console.log('🎯 PDF uploads should now work with Cloudinary integration.');
}

testCloudinaryConfig().catch(console.error);
