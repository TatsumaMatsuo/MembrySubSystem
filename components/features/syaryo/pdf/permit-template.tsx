import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// 日本語フォント登録（Noto Sans JP）
Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: "https://fonts.gstatic.com/ea/notosansjp/v5/NotoSansJP-Regular.otf",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/ea/notosansjp/v5/NotoSansJP-Bold.otf",
      fontWeight: "bold",
    },
  ],
});

// スタイル定義（1ページに収まるようコンパクト化）
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
    fontFamily: "NotoSansJP",
  },
  header: {
    marginBottom: 15,
    borderBottom: "2px solid #1a365d",
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1a365d",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    textAlign: "center",
    color: "#4a5568",
  },
  permitNumber: {
    position: "absolute",
    top: 30,
    right: 30,
    fontSize: 9,
    color: "#a0aec0",
  },
  mainContent: {
    flexDirection: "row",
    marginTop: 10,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 15,
  },
  rightColumn: {
    width: 140,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 10,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 6,
    backgroundColor: "#edf2f7",
    padding: 5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  label: {
    width: 80,
    fontSize: 10,
    color: "#4a5568",
  },
  value: {
    flex: 1,
    fontSize: 11,
    color: "#1a202c",
    fontWeight: "bold",
  },
  expirationSection: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: "#fef5e7",
    padding: 10,
    borderRadius: 4,
    borderLeft: "3px solid #ed8936",
  },
  expirationLabel: {
    fontSize: 10,
    color: "#744210",
    marginBottom: 3,
  },
  expirationValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#c05621",
  },
  qrCode: {
    width: 100,
    height: 100,
    marginBottom: 8,
  },
  qrNote: {
    fontSize: 8,
    color: "#718096",
    textAlign: "center",
  },
  footer: {
    marginTop: "auto",
    paddingTop: 12,
    borderTop: "1px solid #e2e8f0",
  },
  issuerSection: {
    marginBottom: 8,
  },
  issuerTitle: {
    fontSize: 9,
    color: "#4a5568",
    marginBottom: 4,
  },
  issuerCompany: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1a202c",
  },
  issuerAddress: {
    fontSize: 9,
    color: "#4a5568",
    marginTop: 2,
  },
  issuerDepartment: {
    fontSize: 9,
    color: "#4a5568",
    marginTop: 2,
  },
  footerNotes: {
    marginTop: 8,
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#718096",
    textAlign: "center",
    marginBottom: 3,
  },
  footerNote: {
    fontSize: 8,
    color: "#a0aec0",
    textAlign: "center",
  },
});

export interface CompanyInfo {
  company_name: string;
  company_postal_code: string;
  company_address: string;
  issuing_department: string;
}

export interface PermitTemplateProps {
  employeeName: string;
  vehicleNumber: string;
  vehicleModel: string;
  issueDate: Date;
  expirationDate: Date;
  qrCodeDataUrl: string;
  permitId: string;
  companyInfo?: CompanyInfo;
}

/**
 * 日付をフォーマット
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}年${month}月${day}日`;
}

/**
 * 許可証PDFテンプレート（1ページ収まりレイアウト）
 */
export const PermitTemplate: React.FC<PermitTemplateProps> = ({
  employeeName,
  vehicleNumber,
  vehicleModel,
  issueDate,
  expirationDate,
  qrCodeDataUrl,
  permitId,
  companyInfo,
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* 許可証番号 */}
      <Text style={styles.permitNumber}>
        許可証番号: {permitId.substring(0, 8).toUpperCase()}
      </Text>

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>マイカー通勤許可証</Text>
        <Text style={styles.subtitle}>
          Private Vehicle Commuting Permit
        </Text>
      </View>

      {/* メインコンテンツ（2カラムレイアウト） */}
      <View style={styles.mainContent}>
        {/* 左カラム：情報 */}
        <View style={styles.leftColumn}>
          {/* 社員情報 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>許可者情報</Text>
            <View style={styles.row}>
              <Text style={styles.label}>氏名</Text>
              <Text style={styles.value}>{employeeName}</Text>
            </View>
          </View>

          {/* 車両情報 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>車両情報</Text>
            <View style={styles.row}>
              <Text style={styles.label}>車両番号</Text>
              <Text style={styles.value}>{vehicleNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>車名</Text>
              <Text style={styles.value}>{vehicleModel}</Text>
            </View>
          </View>

          {/* 有効期限 */}
          <View style={styles.expirationSection}>
            <Text style={styles.expirationLabel}>有効期限</Text>
            <Text style={styles.expirationValue}>
              {formatDate(expirationDate)}
            </Text>
          </View>

          {/* 発行日 */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>発行日</Text>
              <Text style={styles.value}>{formatDate(issueDate)}</Text>
            </View>
          </View>
        </View>

        {/* 右カラム：QRコード */}
        <View style={styles.rightColumn}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrCodeDataUrl} style={styles.qrCode} />
          <Text style={styles.qrNote}>
            QRコードで有効性を確認
          </Text>
        </View>
      </View>

      {/* フッター */}
      <View style={styles.footer}>
        {/* 発行元情報 */}
        {companyInfo && companyInfo.company_name && (
          <View style={styles.issuerSection}>
            <Text style={styles.issuerTitle}>発行元</Text>
            <Text style={styles.issuerCompany}>{companyInfo.company_name}</Text>
            {(companyInfo.company_postal_code || companyInfo.company_address) && (
              <Text style={styles.issuerAddress}>
                {companyInfo.company_postal_code && `〒${companyInfo.company_postal_code} `}
                {companyInfo.company_address}
              </Text>
            )}
            {companyInfo.issuing_department && (
              <Text style={styles.issuerDepartment}>
                {companyInfo.issuing_department}
              </Text>
            )}
          </View>
        )}

        {/* 注意書き */}
        <View style={styles.footerNotes}>
          <Text style={styles.footerText}>
            本許可証は上記有効期限まで有効です
          </Text>
          <Text style={styles.footerNote}>
            許可証の偽造・変造は禁止されています
          </Text>
        </View>
      </View>
    </Page>
  </Document>
);

export default PermitTemplate;
