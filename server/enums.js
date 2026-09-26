const TRIGGER_TYPES = [
  'fire_alarm',
  'baby_crying',
  'door_knock',
  'doorbell',
  'dog_barking',
];

const TRIGGER_TYPES_LABELS = {
  fire_alarm: 'Fire alarm',
  baby_crying: 'Baby crying',
  door_knock: 'Knocking on door',
  doorbell: 'Doorbell ring',
  dog_barking: 'Dog barking',
};

const DEVICE_TYPES = [
  'light',
  'microphone',
  'speaker',
  'camera'
];

module.exports = { TRIGGER_TYPES, TRIGGER_TYPES_LABELS, DEVICE_TYPES };