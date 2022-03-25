import { useEffect, useMemo, useState, useCallback } from 'react'
import * as anchor from '@project-serum/anchor'

import styled from 'styled-components'
import {
  Button,
  Container,
  Link,
  Snackbar,
  Typography
} from '@material-ui/core'
import Paper from '@material-ui/core/Paper'
import Alert from '@material-ui/lab/Alert'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  WalletDialogButton,
  WalletDisconnectButton
} from '@solana/wallet-adapter-material-ui'
import {
  awaitTransactionSignatureConfirmation,
  CandyMachineAccount,
  CANDY_MACHINE_PROGRAM,
  getCandyMachineState,
  mintOneToken
} from './candy-machine'
import { AlertState } from './utils'
import { MintInfo } from './MintInfo'
import { MintButton } from './MintButton'
import { GatewayProvider } from '@civic/solana-gateway-react'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import king from './assets/img/king.png'
import brandLogo from './assets/img/brand-logo.svg'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    nav: {
      display: 'flex',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(5)
    },
    navLinks: {
      display: 'flex',
      alignItems: 'center'
    },
    navLinkItem: {
      fontWeight: 'bold',
      marginRight: theme.spacing(1),
      '&:last-of-type': {
        marginRight: 0
      }
    },
    navSocial: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%'
    },
    image: {
      borderRadius: `0.25rem`,
      width: '100%'
    },
    mintContainer: {
      marginBottom: theme.spacing(5)
    },
    social: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginTop: theme.spacing(5)
    },
    icon: {
      color: '#c29947',
      margin: theme.spacing(2),
      '&:hover': {
        color: '#fff'
      }
    },
    createdBy: {
      textAlign: 'center',
      margin: theme.spacing(5),
      fontWeight: 'bold'
    },
    brand: {
      maxWidth: '40%'
    },
    paper: {
      padding: theme.spacing(3)
    }
  })
)

const ConnectButton = styled(WalletDialogButton)`
  width: 100%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  background-color: #c29947;
  font-size: 16px;
  font-weight: bold;
`

const DisconnectButton = styled(WalletDisconnectButton)`
  border: 1px solid #c29947;
  border-radius: 0.25rem;
  color: #101d2c;
  font-weight: bold;
  background-color: #c29947;

  &:hover {
    color: #c29947;
    background-color: #101d2c;
  }
`

const MintSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const MintContainer = styled.div`` // add your owns styles here

export interface HomeProps {
  candyMachineId?: anchor.web3.PublicKey
  connection: anchor.web3.Connection
  startDate: number
  txTimeout: number
  rpcHost: string
}

const Home = (props: HomeProps) => {
  const classes = useStyles()
  const [isUserMinting, setIsUserMinting] = useState(false)
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>()
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: '',
    severity: undefined
  })

  const rpcUrl = props.rpcHost
  const wallet = useWallet()

  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction
    } as anchor.Wallet
  }, [wallet])

  const refreshCandyMachineState = useCallback(async () => {
    if (!anchorWallet) {
      return
    }

    if (props.candyMachineId) {
      try {
        const cndy = await getCandyMachineState(
          anchorWallet,
          props.candyMachineId,
          props.connection
        )
        setCandyMachine(cndy)
      } catch (e) {
        console.log('There was a problem fetching Candy Machine state!')
        console.log(e)
      }
    }
  }, [anchorWallet, props.candyMachineId, props.connection])

  const onMint = async () => {
    try {
      setIsUserMinting(true)
      document.getElementById('#identity')?.click()
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        const mintTxId = (await mintOneToken(candyMachine, wallet.publicKey))[0]

        let status: any = { err: true }
        if (mintTxId) {
          status = await awaitTransactionSignatureConfirmation(
            mintTxId,
            props.txTimeout,
            props.connection,
            true
          )
        }

        if (status && !status.err) {
          setAlertState({
            open: true,
            message: 'Congratulations! Mint succeeded!',
            severity: 'success'
          })
        } else {
          setAlertState({
            open: true,
            message: 'Mint failed! Please try again!',
            severity: 'error'
          })
        }
      }
    } catch (error: any) {
      let message = error.msg || 'Minting failed! Please try again!'
      if (!error.msg) {
        if (!error.message) {
          message = 'Transaction Timeout! Please try again.'
        } else if (error.message.indexOf('0x137')) {
          message = `SOLD OUT!`
        } else if (error.message.indexOf('0x135')) {
          message = `Insufficient funds to mint. Please fund your wallet.`
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`
          window.location.reload()
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`
        }
      }

      setAlertState({
        open: true,
        message,
        severity: 'error'
      })
    } finally {
      setIsUserMinting(false)
    }
  }

  useEffect(() => {
    refreshCandyMachineState()
  }, [
    anchorWallet,
    props.candyMachineId,
    props.connection,
    refreshCandyMachineState
  ])

  return (
    <Container maxWidth="lg">
      <nav className={classes.nav}>
        <img className={classes.brand} src={brandLogo} alt="" />
        <div className={classes.navLinks}>
          <Button
            href="https://solitaire-dao.in"
            className={classes.navLinkItem}
            color="primary"
          >
            DAO
          </Button>
          <a href="https://discord.gg/4NzpjHfU">
            <i className={`${classes.icon} fa-2x fab fa-discord`} />
          </a>
          <a href="https://twitter.com/solitairesNFT">
            <i className={`${classes.icon} fa-2x fab fa-twitter`} />
          </a>
          {wallet.connected && <DisconnectButton>Disconnect</DisconnectButton>}
        </div>
      </nav>
      <Container maxWidth="lg">
        <MintSection>
          <Container maxWidth="md">
            <Paper className={classes.paper}>
              <img className={classes.image} src={king} alt="King" />
            </Paper>
          </Container>
          <Container maxWidth="xs" style={{ position: 'relative' }}>
            <Paper className={classes.paper}>
              {!wallet.connected ? (
                // <ConnectButton>Connect Wallet</ConnectButton>
                <Typography align="center" variant="h1">
                  Coming Soon
                </Typography>
              ) : (
                <>
                  <MintInfo candyMachine={candyMachine} />
                  <MintContainer>
                    {candyMachine?.state.isActive &&
                    candyMachine?.state.gatekeeper &&
                    wallet.publicKey &&
                    wallet.signTransaction ? (
                      <GatewayProvider
                        wallet={{
                          publicKey:
                            wallet.publicKey ||
                            new PublicKey(CANDY_MACHINE_PROGRAM),
                          //@ts-ignore
                          signTransaction: wallet.signTransaction
                        }}
                        gatekeeperNetwork={
                          candyMachine?.state?.gatekeeper?.gatekeeperNetwork
                        }
                        clusterUrl={rpcUrl}
                        options={{ autoShowModal: false }}
                      >
                        <MintButton
                          candyMachine={candyMachine}
                          isMinting={isUserMinting}
                          onMint={onMint}
                        />
                      </GatewayProvider>
                    ) : (
                      <MintButton
                        candyMachine={candyMachine}
                        isMinting={isUserMinting}
                        onMint={onMint}
                      />
                    )}
                  </MintContainer>
                </>
              )}
            </Paper>
          </Container>
        </MintSection>
        <div className={classes.social}>
          <a href="https://discord.gg/4NzpjHfU">
            <i className={`${classes.icon} fa-2x fab fa-discord`} />
          </a>
          <a href="https://twitter.com/solitairesNFT">
            <i className={`${classes.icon} fa-2x fab fa-twitter`} />
          </a>
        </div>
        <Typography className={classes.createdBy} color={`primary`}>
          Created by{' '}
          <Link href="https://twitter.com/SOLitairesNFT">
            0xNewMoney <i className={`fab fa-twitter`} />
          </Link>
        </Typography>

        <Snackbar
          open={alertState.open}
          autoHideDuration={6000}
          onClose={() => setAlertState({ ...alertState, open: false })}
        >
          <Alert
            onClose={() => setAlertState({ ...alertState, open: false })}
            severity={alertState.severity}
          >
            {alertState.message}
          </Alert>
        </Snackbar>
      </Container>
    </Container>
  )
}

export default Home
