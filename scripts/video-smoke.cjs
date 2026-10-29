// Synthetic codec/rotation/geometry checks. Does not access user media or the database.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { run, probe, videoInfo, conversionArgs } = require('./video-worker.cjs');
async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-qa-'));
  try {
    for (const [name, size, codec, extension, rotate, sar] of [
      ['landscape', '1920x1080', 'libx264', 'mp4', false, '1'],
      ['portrait', '1080x1920', 'libx264', 'mov', false, '1'],
      ['square', '640x640', 'libvpx-vp9', 'webm', false, '1'],
      ['rotated', '1280x720', 'libx264', 'mov', true, '1'],
      ['anamorphic', '720x576', 'libx264', 'mp4', false, '16/15'],
      ['4k', '3840x2160', 'libx264', 'mp4', false, '1'],
    ]) {
      const source = path.join(dir, `${name}.${extension}`), output = path.join(dir, `${name}-out.mp4`);
      await run('ffmpeg', ['-y','-v','error','-f','lavfi','-i',`testsrc2=size=${size}:rate=24`,'-f','lavfi','-i','sine=frequency=440','-t','1','-vf',`setsar=${sar}`,'-c:v',codec,'-threads','1','-c:a',extension === 'webm' ? 'libopus' : 'aac',source]);
      let input = source;
      if (rotate) { input = path.join(dir, 'rotation.mov'); await run('ffmpeg', ['-y','-v','error','-i',source,'-c','copy','-metadata:s:v:0','rotate=90',input]); }
      const original = await probe(input);
      await run('ffmpeg', conversionArgs(input, output, original));
      const result = await probe(output); const info = videoInfo(result);
      const [width,height] = size.split('x').map(Number); const [n,d] = sar.split('/').map(Number);
      const ratio = rotate ? height/width : width/height * (d ? n/d : n);
      assert.ok(Math.abs(info.video.width/info.video.height - ratio) < .01, name);
      assert.ok(Math.max(info.video.width,info.video.height)<=1920);
      assert.ok(Math.min(info.video.width,info.video.height)<=1080);
      assert.equal(info.video.codec_name, 'h264'); assert.equal(info.video.pix_fmt, 'yuv420p');
      assert.ok(result.streams.some(s=>s.codec_type==='audio' && s.codec_name==='aac'));
      assert.ok(Math.abs(info.duration-videoInfo(original).duration)<.2);
      const bytes = await fs.readFile(output);
      assert.ok(bytes.indexOf(Buffer.from('moov')) < bytes.indexOf(Buffer.from('mdat')));
      console.log('PASS', name, info.video.width, info.video.height);
    }
  } finally { await fs.rm(dir, { recursive:true, force:true }); }
}
main().catch(error=>{ console.error(error.message); process.exitCode=1; });
