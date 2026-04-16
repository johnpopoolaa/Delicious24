import { Test } from '@nestjs/testing';
import { NotifChannel } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationSenderService } from './notification-sender.service';

const makePrisma = () => ({
  credit: { findUnique: jest.fn() },
  customer: { findUnique: jest.fn() },
  order: { findUnique: jest.fn() },
  notificationLog: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
});

const makeCredit = (notifChannel: NotifChannel = NotifChannel.WHATSAPP) => ({
  id: 'credit-1',
  balance: { toString: () => '1500.00' },
  customer: { name: 'Ngozi', phone: '+2348012345601', notifChannel },
});

const makeOrder = () => ({
  id: 'order-1',
  total: { toString: () => '1800.00' },
});

const makeCustomer = (notifChannel: NotifChannel = NotifChannel.WHATSAPP) => ({
  id: 'customer-1',
  name: 'Ngozi',
  phone: '+2348012345601',
  notifChannel,
});

describe('NotificationSenderService', () => {
  let service: NotificationSenderService;
  let prisma: ReturnType<typeof makePrisma>;
  let twilioCreate: jest.Mock;

  beforeEach(async () => {
    twilioCreate = jest.fn().mockResolvedValue({ sid: 'SM_test_123' });
    prisma = makePrisma();

    const module = await Test.createTestingModule({
      providers: [
        NotificationSenderService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: 'TWILIO_CLIENT',
          useValue: {
            messages: { create: twilioCreate },
          },
        },
      ],
    }).compile();

    service = module.get(NotificationSenderService);
  });

  // ── sendReminder ─────────────────────────────────────────────────────────────

  describe('sendReminder', () => {
    const basePayload = {
      scheduledJobId: 'job-1',
      creditId: 'credit-1',
      reminderType: 'COURTESY',
      templateId: 'courtesy_v1',
    };

    it('sends WhatsApp message and writes SENT log for WHATSAPP channel', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.WHATSAPP));

      await service.sendReminder(basePayload);

      expect(twilioCreate).toHaveBeenCalledTimes(1);
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'whatsapp:+2348012345601' }),
      );
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduledJobId: 'job-1',
          channel: NotifChannel.WHATSAPP,
          status: 'SENT',
          messageSid: 'SM_test_123',
        }),
      });
    });

    it('sends SMS and writes SENT log for SMS channel', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.SMS));

      await service.sendReminder({ ...basePayload });

      expect(twilioCreate).toHaveBeenCalledTimes(1);
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+2348012345601' }),
      );
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ channel: NotifChannel.SMS, status: 'SENT' }),
      });
    });

    it('sends both channels and writes 2 SENT logs for BOTH', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.BOTH));

      await service.sendReminder(basePayload);

      expect(twilioCreate).toHaveBeenCalledTimes(2);
      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(2);
    });

    it('skips channel if SENT log already exists (dedup on retry)', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.WHATSAPP));
      prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-1', status: 'SENT' });

      await service.sendReminder(basePayload);

      expect(twilioCreate).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('writes FAILED log and throws when Twilio errors', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit(NotifChannel.WHATSAPP));
      twilioCreate.mockRejectedValue(new Error('Twilio unavailable'));

      await expect(service.sendReminder(basePayload)).rejects.toThrow('WHATSAPP: Twilio unavailable');

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'FAILED', error: 'Twilio unavailable' }),
      });
    });

    it('throws when credit is not found', async () => {
      prisma.credit.findUnique.mockResolvedValue(null);

      await expect(service.sendReminder(basePayload)).rejects.toThrow('Credit credit-1 not found');
    });

    it('renders courtesy_v1 template with name and balance', async () => {
      prisma.credit.findUnique.mockResolvedValue(makeCredit());

      await service.sendReminder(basePayload);

      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining('Ngozi') }),
      );
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining('1500.00') }),
      );
    });
  });

  // ── sendAppreciation ──────────────────────────────────────────────────────────

  describe('sendAppreciation', () => {
    const basePayload = {
      scheduledJobId: 'job-2',
      customerId: 'customer-1',
      orderId: 'order-1',
      templateId: 'appreciation_v1',
    };

    it('sends WhatsApp appreciation and writes SENT log', async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.order.findUnique.mockResolvedValue(makeOrder());

      await service.sendAppreciation(basePayload);

      expect(twilioCreate).toHaveBeenCalledTimes(1);
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduledJobId: 'job-2',
          channel: NotifChannel.WHATSAPP,
          status: 'SENT',
        }),
      });
    });

    it('renders appreciation_v1 template with name and order total', async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());
      prisma.order.findUnique.mockResolvedValue(makeOrder());

      await service.sendAppreciation(basePayload);

      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining('Ngozi') }),
      );
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining('1800.00') }),
      );
    });

    it('throws when customer is not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.sendAppreciation(basePayload)).rejects.toThrow(
        'Customer customer-1 not found',
      );
    });

    it('uses amount 0.00 when orderId is manual', async () => {
      prisma.customer.findUnique.mockResolvedValue(makeCustomer());

      await service.sendAppreciation({
        scheduledJobId: 'job-3',
        customerId: 'customer-1',
        orderId: 'manual',
        templateId: 'appreciation_v1',
      });

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
      expect(twilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining('₦0.00') }),
      );
    });
  });
});
