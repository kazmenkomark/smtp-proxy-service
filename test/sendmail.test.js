const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

// Mock nodemailer
const nodemailer = require('nodemailer');
let sendMailStub;

// The app to be tested
let app;
let server; // To hold the server instance

// Original config content
let originalConfigContent;

describe('Sendmail Service', () => {
  before(() => {
    // Store original config content
    originalConfigContent = fs.readFileSync(path.join(__dirname, '../config.json'), 'utf-8');
  });

  beforeEach(() => {
    // Reset config.json before each test
    fs.writeFileSync(path.join(__dirname, '../config.json'), originalConfigContent);

    // Clear require cache for server.js and config.json to ensure fresh load
    delete require.cache[require.resolve('../server')];
    delete require.cache[require.resolve('../config.json')];

    // Mock nodemailer's sendMail method
    sendMailStub = sinon.stub().resolves('Email sent');
    sinon.stub(nodemailer, 'createTransport').returns({ sendMail: sendMailStub });

    // Load the app after mocking
    app = require('../server');

    // Start the server on a random port for testing
    server = app.listen(0); // Listen on port 0 to get a random available port
  });

  afterEach(() => {
    // Restore nodemailer stub
    sinon.restore();
    // Close the server after each test
    server.close();
  });

  after(() => {
    // Restore original config content after all tests
    fs.writeFileSync(path.join(__dirname, '../config.json'), originalConfigContent);
  });

  // --- Test Cases ---

  it('should send an email successfully with default from/to', async () => {
    const res = await request(app)
      .post('/send')
      .send({ subject: 'Test Subject', text: 'Test Text' });

    expect(res.statusCode).to.equal(200);
    expect(res.body.message).to.equal('Request sent successfully');
    expect(sendMailStub.calledOnce).to.be.true;
    expect(sendMailStub.args[0][0].from).to.equal('teleshop_service@mail.ru');
    expect(sendMailStub.args[0][0].to).to.equal('teleshop_service@mail.ru');
    expect(sendMailStub.args[0][0].subject).to.equal('Test Subject');
    expect(sendMailStub.args[0][0].text).to.equal('Test Text');
  });

  it('should return 400 if subject is missing', async () => {
    const res = await request(app)
      .post('/send')
      .send({ text: 'Test Text' });

    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.equal('Subject and text are required');
    expect(sendMailStub.notCalled).to.be.true;
  });

  it('should return 400 if text is missing', async () => {
    const res = await request(app)
      .post('/send')
      .send({ subject: 'Test Subject' });

    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.equal('Subject and text are required');
    expect(sendMailStub.notCalled).to.be.true;
  });

  it('should return 400 for invalid from email address', async () => {
    // Temporarily modify config to allow overrides for this test
    const configPath = path.join(__dirname, '../config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    currentConfig.mailer.allowClientOverrides = true;
    fs.writeFileSync(configPath, JSON.stringify(currentConfig));

    // Reload app to pick up new config
    delete require.cache[require.resolve('../server')];
    app = require('../server');
    server.close(); // Close old server
    server = app.listen(0); // Start new server

    const res = await request(app)
      .post('/send')
      .send({ subject: 'Test Subject', text: 'Test Text', from: 'invalid-email' });

    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.include('Invalid \'from\' email address');
    expect(sendMailStub.notCalled).to.be.true;
  });

  it('should return 400 for invalid to email address', async () => {
    // Temporarily modify config to allow overrides for this test
    const configPath = path.join(__dirname, '../config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    currentConfig.mailer.allowClientOverrides = true;
    fs.writeFileSync(configPath, JSON.stringify(currentConfig));

    // Reload app to pick up new config
    delete require.cache[require.resolve('../server')];
    app = require('../server');
    server.close(); // Close old server
    server = app.listen(0); // Start new server

    const res = await request(app)
      .post('/send')
      .send({ subject: 'Test Subject', text: 'Test Text', to: 'invalid-email' });

    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.include('Invalid \'to\' email address');
    expect(sendMailStub.notCalled).to.be.true;
  });

  describe('allowClientOverrides: true', () => {
    beforeEach(() => {
      const configPath = path.join(__dirname, '../config.json');
      const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      currentConfig.mailer.allowClientOverrides = true;
      fs.writeFileSync(configPath, JSON.stringify(currentConfig));

      // Reload app to pick up new config
      delete require.cache[require.resolve('../server')];
      app = require('../server');
      server.close(); // Close old server
      server = app.listen(0); // Start new server
    });

    it('should allow overriding from and to fields', async () => {
      const res = await request(app)
        .post('/send')
        .send({
          subject: 'Override Test',
          text: 'This is an override test.',
          from: 'override@example.com',
          to: 'recipient@example.com',
        });

      expect(res.statusCode).to.equal(200);
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.args[0][0].from).to.equal('override@example.com');
      expect(sendMailStub.args[0][0].to).to.equal('recipient@example.com');
    });
  });

  describe('allowClientOverrides: false', () => {
    beforeEach(() => {
      const configPath = path.join(__dirname, '../config.json');
      const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      currentConfig.mailer.allowClientOverrides = false;
      fs.writeFileSync(configPath, JSON.stringify(currentConfig));

      // Reload app to pick up new config
      delete require.cache[require.resolve('../server')];
      app = require('../server');
      server.close(); // Close old server
      server = app.listen(0); // Start new server
    });

    it('should use default from/to and ignore client provided fields', async () => {
      const res = await request(app)
        .post('/send')
        .send({
          subject: 'No Override Test',
          text: 'This should use defaults.',
          from: 'client@example.com', // Should be ignored
          to: 'client@example.com',     // Should be ignored
        });

      expect(res.statusCode).to.equal(400);
      expect(res.body.message).to.include('Overriding \'from\' address is not allowed');
      expect(sendMailStub.notCalled).to.be.true;
    });

    it('should use default from/to if client does not provide them', async () => {
      const res = await request(app)
        .post('/send')
        .send({
          subject: 'No Override Test',
          text: 'This should use defaults.',
        });

      expect(res.statusCode).to.equal(200);
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.args[0][0].from).to.equal('teleshop_service@mail.ru');
      expect(sendMailStub.args[0][0].to).to.equal('teleshop_service@mail.ru');
    });
  });

  describe('Rate Limiting', () => {
    let originalMaxRequests;

    beforeEach(() => {
      const configPath = path.join(__dirname, '../config.json');
      const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      originalMaxRequests = currentConfig.rateLimit.maxRequestsPerMinute;
      currentConfig.rateLimit.maxRequestsPerMinute = 2; // Set a low limit for testing
      fs.writeFileSync(configPath, JSON.stringify(currentConfig));

      // Reload app to pick up new config
      delete require.cache[require.resolve('../server')];
      app = require('../server');
      server.close(); // Close old server
      server = app.listen(0); // Start new server
    });

    afterEach(() => {
      // Restore original rate limit
      const configPath = path.join(__dirname, '../config.json');
      const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      currentConfig.rateLimit.maxRequestsPerMinute = originalMaxRequests;
      fs.writeFileSync(configPath, JSON.stringify(currentConfig));
    });

    it('should limit requests to maxRequestsPerMinute', async () => {
      // First two requests should pass
      let res1 = await request(app)
        .post('/send')
        .send({ subject: 'Rate Limit Test 1', text: 'Test' });
      expect(res1.statusCode).to.equal(200);

      let res2 = await request(app)
        .post('/send')
        .send({ subject: 'Rate Limit Test 2', text: 'Test' });
      expect(res2.statusCode).to.equal(200);

      // Third request should be rate-limited
      let res3 = await request(app)
        .post('/send')
        .send({ subject: 'Rate Limit Test 3', text: 'Test' });
      expect(res3.statusCode).to.equal(429);
      expect(res3.body.message).to.equal('Too many requests from this IP, please try again after a minute');
    }).timeout(5000); // Increase timeout for rate limit test

    it('should reset rate limit after windowMs', async () => {
      // First two requests should pass
      await request(app).post('/send').send({ subject: 'Rate Limit Test 1', text: 'Test' });
      await request(app).post('/send').send({ subject: 'Rate Limit Test 2', text: 'Test' });

      // Third request should be rate-limited
      let res3 = await request(app).post('/send').send({ subject: 'Rate Limit Test 3', text: 'Test' });
      expect(res3.statusCode).to.equal(429);

      // Wait for more than 1 minute (windowMs)
      await new Promise(resolve => setTimeout(resolve, 65 * 1000)); // 65 seconds

      // Request should pass again
      let res4 = await request(app)
        .post('/send')
        .send({ subject: 'Rate Limit Test 4', text: 'Test' });
      expect(res4.statusCode).to.equal(200);
    }).timeout(70 * 1000); // Increase timeout significantly for this test
  });

  it('should return 500 if email sending fails', async () => {
    sendMailStub.rejects(new Error('Nodemailer failed to send')); // Simulate nodemailer failure

    const res = await request(app)
      .post('/send')
      .send({ subject: 'Failure Test', text: 'This should fail.' });

    expect(res.statusCode).to.equal(500);
    expect(res.body.message).to.equal('Nodemailer failed to send');
    expect(sendMailStub.calledOnce).to.be.true;
  });

  it('should exit if SMTP_PASS is not set', (done) => {
    // Unset SMTP_PASS for this test
    const originalSmtpPass = process.env.SMTP_PASS;
    delete process.env.SMTP_PASS;

    // Clear require cache for server.js to ensure fresh load
    delete require.cache[require.resolve('../server')];

    // Stub process.exit to prevent actual exit during test
    const exitStub = sinon.stub(process, 'exit');

    try {
      require('../server'); // This should trigger the exit
      expect(exitStub.calledOnce).to.be.true;
      expect(exitStub.args[0][0]).to.equal(1); // Expect exit code 1
      done();
    } catch (e) {
      done(e);
    } finally {
      // Restore SMTP_PASS and process.exit
      if (originalSmtpPass) {
        process.env.SMTP_PASS = originalSmtpPass;
      }
      exitStub.restore();
    }
  });
});
