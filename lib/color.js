var colors = [
  '#05E4EE',
  '#BB9DFF',
  '#FFB53B',
  '#71F362',
  '#FF90FF',
  '#FF90FF',
  '#1B80FF',
  '#FF2647'
];

function color(i) {
  return colors[i % colors.length];
}

module.exports = color;
