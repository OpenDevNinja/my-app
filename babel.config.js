module.exports = {
    presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
    plugins: [
        'react-native-reanimated/plugin',
        [
            'module-resolver',
            {
              root: ['.'],
              alias: {
                '@': './src',
                '@components': './src/components',
                '@screens': './src/screens',
                '@navigation': './src/navigation',
                '@utils': './src/utils',
                '@services': './src/services',
                '@hooks': './src/hooks',
                '@constants': './src/constants',
                '@assets': './src/assets',
              },
            },
          ],
    ],
  };