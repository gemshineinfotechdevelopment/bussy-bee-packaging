import type { Request, Response, NextFunction } from 'express';
import { Setting } from '../models/Setting';

export const getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settingsList = await Setting.find();
    const defaultSettings: Record<string, any> = {
      isRateEnabledForAdmin: true, // Default: Rate option is enabled for Admin
      companyName: 'Sri Shanmuga Traders',
      companyAddress: '352, Amman Kovil Patti Middle Street, Sivakasi - 626123',
      companyGst: '33BUMPR9147N1ZQ',
      companyState: 'Tamil Nadu',
      companyPhone: '',
    };
    const settingsObj: Record<string, any> = { ...defaultSettings };

    settingsList.forEach((s) => {
      settingsObj[s.key] = s.value;
    });

    res.status(200).json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid settings payload' });
      return;
    }

    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
    }

    const allSettings = await Setting.find();
    const settingsObj: Record<string, any> = {
      isRateEnabledForAdmin: true,
      companyName: 'Sri Shanmuga Traders',
      companyAddress: '352, Amman Kovil Patti Middle Street, Sivakasi - 626123',
      companyGst: '33BUMPR9147N1ZQ',
      companyState: 'Tamil Nadu',
      companyPhone: '',
    };
    allSettings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settingsObj,
    });
  } catch (error) {
    next(error);
  }
};
