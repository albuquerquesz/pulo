// AsyncStorage não tem módulo nativo no Jest: usa o mock oficial do pacote.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
