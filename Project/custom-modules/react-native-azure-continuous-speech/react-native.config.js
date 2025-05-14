module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.azurespeech.continuous.AzureContinuousSpeechPackage;',
        packageInstance: 'new AzureContinuousSpeechPackage()'
      }
    }
  }
};
