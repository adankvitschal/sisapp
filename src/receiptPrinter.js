import escpos from 'escpos';
//USB option
import escpos_usb from 'escpos-usb';
escpos.USB = escpos_usb;
let printer;
try {
    const device  = new escpos.USB();
    //Serial option
    // import Serial from 'escpos-serialport';
    // escpos.SerialPort = Serial;
    // console.log(escpos.SerialPort);
    // const device = new escpos.SerialPort('COM3', {
    //     baudRate: 9600,
    //     startBit: 1,
    //     stopBit: 1
    // });
    //---
    const PRINTER_LINE_WIDTH = 32;  //for 58mm paper
    const options = { encoding: "UTF8" }
    printer = new escpos.Printer(device, options);
} catch(error) {
    console.log("error creating printer: " + error);
}

function teste() {
    return new Promise((resolve, reject) => {
        device.open(async (error) => {
            if(error) {
                console.log("error opening device: " + error);
                reject(error);
            } else {
                // await printer.font('a');
                await printer.align('ct')
                // await printer.style('NORMAL')
                // await printer.size(1, 1);
                await printer.lineSpace(1);

                await printer.text('Associacao de Pais e Professores EMEB Abelhinha Feliz\n');
                await printer.cut();
                await printer.close();
                resolve();
            }
        });
    });
}

// teste().then(() => console.log("test done"));

function valePastel(printer) {
    if(!printer) {
        console.log("printer not found, no receipt printed");
        return;
    }
    return new Promise((resolve, reject) => {
        escpos.Image.load('img/pastel.png', (result) => {
            if(result instanceof Error) {
                console.log("error loading image: " + error);
                reject(error);
            }
            printer.image(result, 'd24');
            resolve();
        });
    });
}

export function saleReceipt(saleInfo) {
    if(!printer) {
        console.log("printer not found, no receipt printed");
        return;
    }
    console.log(saleInfo);
    return new Promise((resolve, reject) => {
        device.open(async (error) => {
            if(error) {
                console.log("error opening device: " + error);
                reject(error);
            } else {
                // await printer.font('a');
                await printer.align('ct')
                // await printer.style('NORMAL')
                // await printer.size(1, 1);
                await printer.lineSpace(1);

                await printer.text('Associacao de Pais e Professores EMEB Abelhinha Feliz\n');
                await printer.text('CNPJ 00.167.800/0001-00\n');
                await printer.text(saleInfo.event_info.event_name);
                
                const numItems = saleInfo.item_name.length;
                let lineBlankSpaces, points;
                await printer.text('-'.repeat(PRINTER_LINE_WIDTH) +'\n');
                for(let i = 0; i < numItems; i++) {
                    if(saleInfo.item_quantity[i] > 0) {
                        const quantityText = saleInfo.item_quantity[i] + 'x ';
                        lineBlankSpaces = PRINTER_LINE_WIDTH
                            - quantityText.length
                            - saleInfo.item_name[i].length
                            - saleInfo.item_price[i].length;
                        points = '.'.repeat(lineBlankSpaces);
                        await printer.text(quantityText + saleInfo.item_name[i] + points + saleInfo.item_price[i] + '\n');
                    }
                }
                await printer.text('-'.repeat(PRINTER_LINE_WIDTH) +'\n');
                const totalText = 'TOTAL';
                const totalValue = saleInfo.sale_total;
                lineBlankSpaces = PRINTER_LINE_WIDTH - totalText.length - totalValue.length;
                points = '.'.repeat(lineBlankSpaces);
                await printer.text(totalText + points + totalValue + '\n');
                
                const codeText = saleInfo.id.slice(0,4) + ' ' 
                    + saleInfo.id.slice(4,8) + ' ' 
                    + saleInfo.id.slice(8,12);
            
                await printer.text(' --- CODIGO VERIFICADOR --- \n');
                await printer.text(codeText + '\n\n');
                await printer.text(' Utilize este codigo para confirmar que sua compra foi contabilizada no relatorio do evento. \n');
                await printer.text(' Mais informacoes com a tesouraria da APP \n');
                
                //await valePastel(printer);

                await printer.cut();
                await printer.close();
                
                resolve();
            }
        });
    });
}